"""Diagnostic flow for the web app (Next.js).

The deterministic steps (create the exam, record answers, grade) run as plain service
calls so the demo never depends on the LLM choosing the right tool. The diagnostic
agent narrates: it greets, answers questions (without hints) and explains the results.
Without Gemini credentials the flow still works; only the narration is missing.
"""

from __future__ import annotations

import copy
import logging
from typing import Any

from google.adk.events import Event, EventActions
from google.adk.runners import Runner

from . import services
from . import state as st
from .config import get_settings
from .db import RazonaRepository
from .runtime import send_message
from .session import initial_state, resolve_student

logger = logging.getLogger(__name__)

INTRO_MESSAGE = "Acabo de iniciar mi examen diagnóstico en la app. Salúdame y explícame cómo funciona."
RESULTS_MESSAGE = "Ya terminé mi diagnóstico. Explícame mis resultados."


class DiagnosticError(ValueError):
    """Invalid request for the current diagnostic (shown to the student)."""


def agent_available() -> bool:
    return get_settings().has_model_credentials


def _diagnostic(state: dict[str, Any]) -> dict[str, Any]:
    diag = state.get(st.DIAGNOSTIC)
    if not isinstance(diag, dict) or not diag.get("exam_id"):
        raise DiagnosticError("Esta sesión no tiene un examen diagnóstico.")
    return diag


def build_status(repo: RazonaRepository, user_id: str, state: dict[str, Any]) -> dict[str, Any]:
    """Structured state for the UI: progress, current item (without answer) and, once graded, results."""
    diag = _diagnostic(state)
    item_ids: list[str] = diag["item_ids"]
    answers = {a.item_id: a.selected_option for a in repo.exam_answers(user_id, diag["exam_id"])}
    finished = bool(diag.get("finalizado"))

    current: dict[str, Any] | None = None
    if not finished:
        for index, item_id in enumerate(item_ids):
            if item_id in answers:
                continue
            item = repo.get_item(item_id)
            if item is not None:
                current = {
                    **item.to_public(repo.specialty_name(item.specialty_id)).model_dump(mode="json"),
                    "numero": index + 1,
                }
            break

    result = None
    if finished:
        # Idempotent for a graded exam: reads what was stored. Works on a copy of the state.
        result = services.grade_diagnostic(repo, user_id, copy.deepcopy(state))

    return {
        "exam_id": diag["exam_id"],
        "total": len(item_ids),
        "respondidas": sum(1 for i in item_ids if i in answers),
        "finalizado": finished,
        "reactivos": [
            {"id": item_id, "numero": i + 1, "respondido": item_id in answers}
            for i, item_id in enumerate(item_ids)
        ],
        "reactivo_actual": current,
        "resultado": result,
    }


async def _narrate(runner: Runner, user_id: str, session_id: str, text: str) -> list[dict]:
    """Agent turn; never breaks the flow (returns [] if Gemini is unavailable or fails)."""
    if not agent_available():
        return []
    try:
        replies = await send_message(runner, user_id, session_id, text)
    except Exception:  # demo reliability: the deterministic flow continues without narration
        logger.exception("Falló el turno del agente de diagnóstico")
        return []
    return [r for r in replies if not r["texto"].startswith("[error]")]


async def start(
    runner: Runner, repo: RazonaRepository, user_id: str, n_per_specialty: int = 2
) -> dict[str, Any]:
    student = resolve_student(repo, user_id=user_id)
    state = initial_state(student)
    created = services.create_diagnostic(repo, student.id, state, n_per_specialty)
    if "error" in created:
        raise DiagnosticError(created["error"])
    session = await runner.session_service.create_session(
        app_name=runner.app_name, user_id=student.id, state=state
    )
    replies = await _narrate(runner, student.id, session.id, INTRO_MESSAGE)
    return await _response(runner, repo, student.id, session.id, replies)


async def _load_state(runner: Runner, user_id: str, session_id: str) -> dict[str, Any]:
    session = await runner.session_service.get_session(
        app_name=runner.app_name, user_id=user_id, session_id=session_id
    )
    if session is None:  # unknown id or a session of another student
        raise LookupError("Sesión no encontrada.")
    return dict(session.state)


async def _response(
    runner: Runner, repo: RazonaRepository, user_id: str, session_id: str, replies: list[dict]
) -> dict[str, Any]:
    state = await _load_state(runner, user_id, session_id)
    return {
        "session_id": session_id,
        "agente_disponible": agent_available(),
        "estado": build_status(repo, user_id, state),
        "respuestas": replies,
    }


async def answer(
    runner: Runner,
    repo: RazonaRepository,
    user_id: str,
    session_id: str,
    item_id: str,
    option: str,
) -> dict[str, Any]:
    state = await _load_state(runner, user_id, session_id)
    result = services.register_answer(repo, user_id, state, item_id, option)
    if "error" in result:
        raise DiagnosticError(result["error"])
    return await _response(runner, repo, user_id, session_id, [])


async def message(
    runner: Runner, repo: RazonaRepository, user_id: str, session_id: str, text: str
) -> dict[str, Any]:
    await _load_state(runner, user_id, session_id)
    replies = await _narrate(runner, user_id, session_id, text)
    return await _response(runner, repo, user_id, session_id, replies)


async def grade(
    runner: Runner, repo: RazonaRepository, user_id: str, session_id: str
) -> dict[str, Any]:
    session = await runner.session_service.get_session(
        app_name=runner.app_name, user_id=user_id, session_id=session_id
    )
    if session is None:
        raise LookupError("Sesión no encontrada.")
    state = dict(session.state)
    diag = _diagnostic(state)
    if not diag.get("finalizado"):
        result = services.grade_diagnostic(repo, user_id, state)
        if "error" in result:
            raise DiagnosticError(result["error"])
        await runner.session_service.append_event(
            session,
            Event(
                author="system",
                actions=EventActions(
                    state_delta={st.DIAGNOSTIC: state[st.DIAGNOSTIC], st.ACTIVE_EXAM: None}
                ),
            ),
        )
    replies = await _narrate(runner, user_id, session_id, RESULTS_MESSAGE)
    return await _response(runner, repo, user_id, session_id, replies)
