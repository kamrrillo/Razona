"""Session-state keys and helpers.

The student's id lives in ADK session state (``razona_user_id``). Tools read it
from ``tool_context.state``; it is never taken from the LLM's arguments.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

USER_ID = "razona_user_id"
USER_NAME = "razona_nombre"
USER_EMAIL = "razona_email"
ACTIVE_EXAM = "razona_examen_activo"
DIAGNOSTIC = "razona_diagnostico"
"""dict: exam_id, item_ids (ordered), finalizado."""
ACTIVE_CASE = "razona_caso_activo"
SOLVED_CASES = "razona_casos_resueltos"


class MissingUserError(RuntimeError):
    pass


def user_id_from_state(state: Mapping[str, Any]) -> str:
    user_id = state.get(USER_ID)
    if not user_id:
        raise MissingUserError(
            "La sesión no tiene estudiante. Crea la sesión con razona_agent.session."
            "create_student_session(...) o con el estado inicial {'razona_user_id': '<uuid>'}."
        )
    return str(user_id)


def active_diagnostic(state: Mapping[str, Any]) -> dict[str, Any] | None:
    diag = state.get(DIAGNOSTIC)
    if isinstance(diag, dict) and diag.get("exam_id") and not diag.get("finalizado"):
        return diag
    return None


def protected_item_ids(state: Mapping[str, Any]) -> list[str]:
    """Items whose answer must not be revealed right now (guardrail)."""
    ids: list[str] = []
    diag = active_diagnostic(state)
    if diag:
        ids.extend(diag.get("item_ids", []))
    case_id = state.get(ACTIVE_CASE)
    if case_id and case_id not in (state.get(SOLVED_CASES) or []):
        ids.append(case_id)
    return ids
