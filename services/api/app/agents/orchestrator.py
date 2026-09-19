import os
from functools import lru_cache
from typing import TypedDict

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, END

from app.agents.prompts import MODE_PROMPTS, DEFAULT_MODE


class ForgeState(TypedDict):
    messages: list
    mode: str
    project_id: int
    user_id: int
    world_context: dict | None
    character_context: dict | None
    design_version: int


@lru_cache(maxsize=1)
def _get_llm() -> ChatGoogleGenerativeAI:
    """
    Lazily constructed and cached so importing this module doesn't require
    GEMINI_API_KEY to be set (useful for tests); it's only required once a
    mode agent actually runs.
    """
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    return ChatGoogleGenerativeAI(model=model_name, temperature=0.8)


def _to_langchain_messages(mode: str, messages: list) -> list:
    """Converts our simple {role, content} dicts into LangChain message objects,
    prepending the mode's persona system prompt."""
    system_prompt = MODE_PROMPTS.get(mode, MODE_PROMPTS[DEFAULT_MODE])
    lc_messages: list = [SystemMessage(content=system_prompt)]
    for m in messages:
        if m["role"] == "user":
            lc_messages.append(HumanMessage(content=m["content"]))
        else:
            lc_messages.append(AIMessage(content=m["content"]))
    return lc_messages


async def _run_mode_agent(state: ForgeState) -> dict:
    mode = state.get("mode", DEFAULT_MODE)
    llm = _get_llm()
    lc_messages = _to_langchain_messages(mode, state["messages"])
    response = await llm.ainvoke(lc_messages)
    return {"messages": state["messages"] + [{"role": "agent", "content": response.content}]}


# All eight modes currently share the same call shape (persona system prompt +
# conversation history -> one response) -- they differ only in which prompt
# gets selected, which _run_mode_agent already handles via state["mode"].
# Kept as separate graph nodes (rather than one node) so future modes can grow
# divergent behavior (e.g. world/character modes pulling in extra context)
# without reshaping the graph.
async def vehicle_agent(s):
    return await _run_mode_agent(s)


async def interior_agent(s):
    return await _run_mode_agent(s)


async def product_agent(s):
    return await _run_mode_agent(s)


async def architecture_agent(s):
    return await _run_mode_agent(s)


async def world_agent(s):
    return await _run_mode_agent(s)


async def character_agent(s):
    return await _run_mode_agent(s)


async def telecom_agent(s):
    return await _run_mode_agent(s)


async def servers_agent(s):
    return await _run_mode_agent(s)


async def supervisor(s):
    mode = s.get("mode", DEFAULT_MODE)
    return mode if mode in MODE_PROMPTS else DEFAULT_MODE


_b = StateGraph(ForgeState)
_NODES = {
    "vehicle": vehicle_agent,
    "interior": interior_agent,
    "product": product_agent,
    "architecture": architecture_agent,
    "world": world_agent,
    "character": character_agent,
    "telecom": telecom_agent,
    "servers": servers_agent,
}
for _name, _fn in _NODES.items():
    _b.add_node(_name, _fn)
_b.set_conditional_entry_point(supervisor)
for _name in _NODES:
    _b.add_edge(_name, END)

# MemorySaver gives each thread_id (one per project, see routers/agent.py)
# short-term conversational continuity *within a running API process* --
# the LLM remembers earlier turns in the same session without the caller
# re-sending the whole history. It resets on restart and does not share
# state across multiple API instances behind a load balancer.
#
# The durable, restart-proof log is separate: every turn is also written to
# the design_versions table (see routers/agent.py), and GET
# /projects/{id}/messages reconstructs the full conversation from there for
# the chat UI to reload. If you scale to multiple API instances, replace
# MemorySaver with a shared backend (e.g. langgraph-checkpoint-postgres)
# so mid-conversation continuity survives a request landing on a different
# instance -- the design_versions log itself needs no change either way.
forge_graph = _b.compile(checkpointer=MemorySaver())
