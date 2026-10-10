"""
Per-request authorization checks shared by the routers.

get_current_user (app/auth.py) answers "who is this?"; these answer "may
they do this?": does the project belong to them, does their plan include
the mode, and do they have renders left this month. The plan fields on
users (allowed_modes, render_quota) are written by the PayPal webhook's
_grant in routers/billing.py.
"""
from fastapi import HTTPException

from app.agents.prompts import MODE_PROMPTS

RENDER_FEATURE = "render"


async def get_owned_project(db, project_id: int, user: dict):
    # 404 rather than 403 for someone else's project, so ids can't be probed.
    project = await db.fetchrow(
        "SELECT * FROM projects WHERE id=$1 AND user_id=$2", project_id, user["id"]
    )
    if not project:
        raise HTTPException(404, "Project not found")
    return project


def require_mode(user: dict, mode: str) -> None:
    if mode not in MODE_PROMPTS:
        raise HTTPException(400, f"Unknown mode: {mode}")
    if mode not in (user.get("allowed_modes") or []):
        raise HTTPException(403, f"Your {user.get('tier', 'free')} plan doesn't include the {mode} mode")


async def renders_used_this_month(db, user_id: int) -> int:
    return await db.fetchval(
        "SELECT COALESCE(SUM(quantity), 0) FROM usage_events "
        "WHERE user_id=$1 AND feature=$2 AND created_at >= date_trunc('month', now())",
        user_id,
        RENDER_FEATURE,
    )


async def require_render_quota(db, user: dict) -> None:
    quota = user.get("render_quota") or 0
    if quota < 0:  # -1 = unlimited (studio tier)
        return
    if await renders_used_this_month(db, user["id"]) >= quota:
        raise HTTPException(403, f"You've used all {quota} renders on your plan this month")


async def record_render(db, user_id: int, project_id: int) -> None:
    await db.execute(
        "INSERT INTO usage_events (user_id, feature, metadata) VALUES ($1, $2, $3)",
        user_id,
        RENDER_FEATURE,
        {"project_id": project_id},
    )
