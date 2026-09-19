from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.routers import auth, projects, agent, assets, billing, users

app = FastAPI(title="FORGE AI API", version="0.1.0")
# Multi-user app now -- CORS still scoped to the one web frontend origin,
# but auth itself is per-user JWTs, not a single shared secret.
allowed_origin = os.getenv("WEB_ORIGIN", "http://localhost:3000")
app.add_middleware(CORSMiddleware, allow_origins=[allowed_origin], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(agent.router)
app.include_router(assets.router)
app.include_router(billing.router)
@app.get("/health")
async def health(): return {"status": "ok", "app": "FORGE AI"}
