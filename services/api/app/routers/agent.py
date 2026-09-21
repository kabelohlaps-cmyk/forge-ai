from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user
from app.db import get_db
from app.agents.orchestrator import forge_graph
from app.services.image_gen import generate_design_image, bytes_to_data_uri
import json

router = APIRouter(prefix="/agent", tags=["agent"])


class AgentRequest(BaseModel):
    project_id: int
    mode: str
    prompt: str


class ImageRequest(BaseModel):
    project_id: int
    mode: str
    prompt: str


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

    agent_reply = result["messages"][-1]["content"]

    # Durable log: one row per turn, independent of the in-memory checkpointer.
    row = await db.fetchrow(
        "INSERT INTO design_versions (project_id, mode, prompt, spec_sheet) VALUES ($1, $2, $3, $4) RETURNING id",
        body.project_id,
        body.mode,
        body.prompt,
        json.dumps({"response": agent_reply}),
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
        json.dumps(spec_sheet),
        latest["id"],
    )

    return {"image_data_uri": data_uri, "design_version_id": latest["id"]}
