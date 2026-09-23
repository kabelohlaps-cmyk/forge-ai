from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user
from app.db import get_db
from app.agents.orchestrator import forge_graph
from app.services.image_gen import generate_design_image, bytes_to_data_uri

router = APIRouter(prefix="/agent", tags=["agent"])


class AgentRequest(BaseModel):
    project_id: int
    mode: str
    prompt: str


class ImageRequest(BaseModel):
    project_id: int
    mode: str
    prompt: str


def _extract_text(content) -> str:
    """
    Gemini/LangChain message content isn't always a plain string -- for
    some models (and whenever extended-thinking signatures are attached)
    it comes back as a list of content blocks like
    [{"type": "text", "text": "...", "extras": {...}}]. Storing that raw
    structure breaks both JSON round-tripping and the frontend (which
    expects message.content to be a string it can render directly).
    This flattens any shape down to the plain text.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text" and "text" in block:
                    parts.append(block["text"])
                elif "text" in block:
                    parts.append(block["text"])
            elif isinstance(block, str):
                parts.append(block)
        return "".join(parts)
    return str(content)


@router.post("/invoke")
async def invoke_agent(body: AgentRequest, user=Depends(get_current_user), db=Depends(get_db)):
    state = {
        "messages": [{"role": "user", "content": body.prompt}],
        "mode": body.mode,
        "project_id": body.project_id,
        "user_id": user["id"],
        "world_context": None,
        "character_context": None,
        "design_version": 1,
    }
    # thread_id ties this call to the project's ongoing MemorySaver session --
    # see orchestrator.py for what that does and doesn't persist.
    config = {"configurable": {"thread_id": f"project_{body.project_id}"}}
    result = await forge_graph.ainvoke(state, config=config)

    agent_reply = _extract_text(result["messages"][-1]["content"])

    # Durable log: one row per turn, independent of the in-memory checkpointer.
    # NOTE: spec_sheet is passed as a plain dict, not json.dumps(...) -- the
    # asyncpg connection pool has a jsonb codec registered (see db.py) that
    # handles serialization itself. Pre-serializing here would double-encode
    # it and break the very next read of this row.
    row = await db.fetchrow(
        "INSERT INTO design_versions (project_id, mode, prompt, spec_sheet) VALUES ($1, $2, $3, $4) RETURNING id",
        body.project_id,
        body.mode,
        body.prompt,
        {"response": agent_reply},
    )

    return {"result": result, "reply": agent_reply, "design_version_id": row["id"]}


@router.post("/generate-image")
async def generate_image(body: ImageRequest, user=Depends(get_current_user), db=Depends(get_db)):
    """
    Generates an image for the most recent design_versions row in this
    project (the one /agent/invoke just created) and attaches it there,
    so it shows up alongside that turn when the chat history reloads.
    """
    project = await db.fetchrow(
        "SELECT id FROM projects WHERE id=$1 AND user_id=$2", body.project_id, user["id"]
    )
    if not project:
        raise HTTPException(404, "Project not found")

    latest = await db.fetchrow(
        "SELECT id, spec_sheet FROM design_versions WHERE project_id=$1 ORDER BY id DESC LIMIT 1",
        body.project_id,
    )
    if not latest:
        raise HTTPException(400, "No conversation turn to attach this image to yet")

    try:
        image_bytes = await generate_design_image(body.prompt, body.mode)
    except Exception as e:
        raise HTTPException(502, f"Image generation failed: {e}")

    data_uri = bytes_to_data_uri(image_bytes)
    spec_sheet = dict(latest["spec_sheet"] or {})
    spec_sheet["image_data_uri"] = data_uri

    await db.execute(
        "UPDATE design_versions SET spec_sheet=$1 WHERE id=$2",
        spec_sheet,
        latest["id"],
    )

    return {"image_data_uri": data_uri, "design_version_id": latest["id"]}
