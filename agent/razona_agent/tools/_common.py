"""Shared helpers for the tool wrappers."""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from ..db import RazonaRepository, get_repository
from ..state import MissingUserError, user_id_from_state

logger = logging.getLogger(__name__)


def run_tool(
    tool_context: Any,
    fn: Callable[[RazonaRepository, str], dict[str, Any]],
) -> dict[str, Any]:
    """Runs ``fn(repo, user_id)`` with the user id from session state; errors become dicts.

    The user id ALWAYS comes from ``tool_context.state`` (set when the session is
    created), never from the model's arguments.
    """
    try:
        user_id = user_id_from_state(tool_context.state)
        return fn(get_repository(), user_id)
    except MissingUserError as exc:
        return {"error": str(exc)}
    except Exception as exc:  # demo reliability: report instead of crashing the turn
        logger.exception("Tool error")
        return {"error": f"No se pudo completar la operación: {exc}"}


def run_content_tool(fn: Callable[[RazonaRepository], dict[str, Any]]) -> dict[str, Any]:
    """Same as run_tool for tools that only read global content."""
    try:
        return fn(get_repository())
    except Exception as exc:
        logger.exception("Tool error")
        return {"error": f"No se pudo completar la operación: {exc}"}
