"""Runner wiring shared by the CLI and the FastAPI server."""

from __future__ import annotations

from functools import lru_cache

from google.adk.agents import BaseAgent
from google.adk.runners import Runner
from google.adk.sessions import BaseSessionService, InMemorySessionService
from google.genai import types

from .config import APP_NAME, get_settings

ADK_SCHEMA = "adk"


def _async_url(url: str) -> str:
    """postgresql://… (as Supabase shows it) → postgresql+asyncpg://…"""
    for prefix in ("postgresql+asyncpg://", "postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+asyncpg://" + url[len(prefix) :]
    return url


@lru_cache(maxsize=1)
def session_service() -> BaseSessionService:
    """ADK sessions: Postgres (schema ``adk``) if ADK_SESSIONS_DB_URL is set, otherwise in memory.

    On serverless hosts (Vercel) consecutive requests can land on different instances, so the
    in-memory store would lose the diagnostic between requests; there the database is required.
    The ``adk`` schema is not exposed by Supabase's Data API (only ``public`` is).
    """
    url = get_settings().adk_sessions_db_url
    if not url:
        return InMemorySessionService()

    from google.adk.sessions import DatabaseSessionService
    from sqlalchemy.pool import NullPool

    return DatabaseSessionService(
        db_url=_async_url(url),
        # Serverless: no idle pooled connections across frozen instances.
        poolclass=NullPool,
        connect_args={
            "server_settings": {"search_path": ADK_SCHEMA},
            # Supabase's pooler (Supavisor) does not support prepared statements in transaction mode.
            "statement_cache_size": 0,
        },
    )


def build_runner(agent: BaseAgent | None = None) -> Runner:
    """Runner for an agent; ADK sessions come from ``session_service()`` (the source of truth is Supabase)."""
    if agent is None:
        from .agent import root_agent

        agent = root_agent
    return Runner(app_name=APP_NAME, agent=agent, session_service=session_service())


async def send_message(runner: Runner, user_id: str, session_id: str, text: str) -> list[dict]:
    """Runs one user turn and returns the final text replies as [{autor, texto}]."""
    replies: list[dict] = []
    message = types.Content(role="user", parts=[types.Part(text=text)])
    async for event in runner.run_async(user_id=user_id, session_id=session_id, new_message=message):
        if event.error_message:
            replies.append({"autor": event.author, "texto": f"[error] {event.error_message}"})
            continue
        if event.is_final_response() and event.content and event.content.parts:
            chunk = "".join(p.text or "" for p in event.content.parts if not p.thought).strip()
            if chunk:
                replies.append({"autor": event.author, "texto": chunk})
    return replies
