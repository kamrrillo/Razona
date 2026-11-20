"""Runner wiring shared by the CLI and the FastAPI server."""

from __future__ import annotations

from google.adk.agents import BaseAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from .config import APP_NAME


def build_runner(agent: BaseAgent | None = None) -> Runner:
    """Runner with in-memory ADK sessions (the source of truth is Supabase)."""
    if agent is None:
        from .agent import root_agent

        agent = root_agent
    return Runner(app_name=APP_NAME, agent=agent, session_service=InMemorySessionService())


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
