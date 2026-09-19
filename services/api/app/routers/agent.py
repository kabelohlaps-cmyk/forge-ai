from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.auth import get_current_user
from app.db import get_db
from app.agents.orchestrator import forge_graph
import json

router = APIRouter(prefix="/agent", tags=["agent"])


class AgentRequest(BaseModel):
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
    await db.execute(
        "INSERT INTO design_versions (project_id, mode, prompt, spec_sheet) VALUES ($1, $2, $3, $4)",
        body.project_id,
        body.mode,
        body.prompt,
        json.dumps({"response": agent_reply}),
    )

    return {"result": result, "reply": agent_reply}
