import asyncpg
from pgvector.asyncpg import register_vector
class AgentMemory:
    def __init__(self, pool: asyncpg.Pool): self.pool = pool
    async def store_design_memory(self, project_id, content, embedding, memory_type="design"):
        async with self.pool.acquire() as c:
            await register_vector(c)
            await c.execute("INSERT INTO design_memories (project_id,content,embedding,memory_type,created_at) VALUES ($1,$2,$3,$4,now())", project_id, content, embedding, memory_type)
    async def recall_similar(self, project_id, query_embedding, limit=5):
        async with self.pool.acquire() as c:
            await register_vector(c)
            rows = await c.fetch("SELECT content,memory_type,1-(embedding<=>$1) AS similarity FROM design_memories WHERE project_id=$2 ORDER BY embedding<=>$1 LIMIT $3", query_embedding, project_id, limit)
            return [dict(r) for r in rows]
