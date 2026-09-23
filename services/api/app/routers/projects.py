from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.db import get_db
from app.auth import get_current_user
import json

router = APIRouter(prefix="/projects", tags=["projects"])


class CreateProjectRequest(BaseModel):
    title: str
    mode: str
    brief: str = ""


@router.get("/")
async def list_projects(user=Depends(get_current_user), db=Depends(get_db)):
    rows = await db.fetch("SELECT * FROM projects WHERE user_id=$1 ORDER BY created_at DESC", user["id"])
    return [dict(r) for r in rows]


@router.get("/{project_id}")
async def get_project(project_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    row = await db.fetchrow("SELECT * FROM projects WHERE id=$1 AND user_id=$2", project_id, user["id"])
    if not row:
        from fastapi import HTTPException
        raise HTTPException(404, "Project not found")
    return dict(row)


@router.get("/{project_id}/messages")
async def get_project_messages(project_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    """
    Reconstructs the conversation from design_versions rows (each row =
    one user prompt + the agent's response, written by /agent/invoke).
    This is the durable log -- it's what survives an API restart, separate
    from LangGraph's in-memory checkpointer which only holds the LLM's
    short-term working context for a running process.
    """
    project = await db.fetchrow("SELECT id FROM projects WHERE id=$1 AND user_id=$2", project_id, user["id"])
    if not project:
        from fastapi import HTTPException
        raise HTTPException(404, "Project not found")

    rows = await db.fetch(
        "SELECT prompt, spec_sheet, created_at FROM design_versions WHERE project_id=$1 ORDER BY created_at ASC",
        project_id,
    )
    messages = []
    for row in rows:
        messages.append({"role": "user", "content": row["prompt"]})
        raw_spec_sheet = row["spec_sheet"] or {}
        # asyncpg returns JSONB columns as a raw JSON string, not a parsed
        # dict, unless a codec is registered -- parse defensively here so
        # this works whether or not that's the case.
        spec_sheet = json.loads(raw_spec_sheet) if isinstance(raw_spec_sheet, str) else raw_spec_sheet
        response = spec_sheet.get("response")
        if response:
            agent_msg = {"role": "agent", "content": response}
            image_data_uri = spec_sheet.get("image_data_uri")
            if image_data_uri:
                agent_msg["image_data_uri"] = image_data_uri
            messages.append(agent_msg)
    return {"messages": messages}


@router.post("/")
async def create_project(body: CreateProjectRequest, user=Depends(get_current_user), db=Depends(get_db)):
    r = await db.fetchrow(
        "INSERT INTO projects (user_id,title,mode,brief) VALUES ($1,$2,$3,$4) RETURNING *",
        user["id"], body.title, body.mode, body.brief,
    )
    return dict(r)
