import json
import os
import asyncpg
from typing import AsyncIterator

_pool: asyncpg.Pool | None = None


async def _init_connection(conn: asyncpg.Connection):
    # asyncpg does not auto-decode json/jsonb columns into Python objects
    # by default -- without this, columns like design_versions.spec_sheet
    # come back as raw JSON strings, and any code calling .get(...) on
    # them blows up with an AttributeError (which FastAPI turns into a 500).
    await conn.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
        format="text",
    )
    await conn.set_type_codec(
        "json",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
        format="text",
    )


async def init_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            os.getenv("DATABASE_URL", "postgresql://forge:forge@localhost:5432/forge"),
            min_size=2,
            max_size=10,
            init=_init_connection,
        )
    return _pool


async def get_db() -> AsyncIterator[asyncpg.Connection]:
    pool = await init_pool()
    async with pool.acquire() as conn:
        yield conn
