import os
import asyncpg
from typing import AsyncIterator
_pool: asyncpg.Pool | None = None
async def init_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(os.getenv("DATABASE_URL","postgresql://forge:forge@localhost:5432/forge"), min_size=2, max_size=10)
    return _pool
async def get_db() -> AsyncIterator[asyncpg.Connection]:
    pool = await init_pool()
    async with pool.acquire() as conn:
        yield conn
