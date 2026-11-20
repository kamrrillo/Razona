"""ADK callbacks: student resolution, credentials check and the answer guardrail."""

from __future__ import annotations

import logging
import re
import unicodedata

from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.genai import types

from . import state as st
from .config import MISSING_KEY_MESSAGE, get_settings
from .db import get_repository
from .models import Item
from .session import initial_state, student_for_adk_user

logger = logging.getLogger(__name__)

_REVEAL_PHRASES = re.compile(
    r"(la )?respuesta correcta (es|seria)|opcion correcta (es|seria)|inciso correcto"
)


def normalize(value: str) -> str:
    """Lowercase, strip accents and collapse spaces (same as tutor-engine.ts)."""
    decomposed = unicodedata.normalize("NFD", value.lower())
    no_accents = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", no_accents).strip()


def reveals_answer(text: str, item: Item) -> bool:
    """Port of ``revealsAnswer`` (lib/ai/tutor-engine.ts), extended for the chat setting.

    - Phrases like "la respuesta correcta es" / "opción correcta es" / "inciso correcto".
    - "la (opción|inciso|respuesta) <letra correcta> es (la) correcta".
    - The correct option's text (>= 12 chars), unless the reply lists ALL the options
      (i.e. it is presenting the item, which the diagnostic/tutor agents must do).
    """
    t = normalize(text)
    if _REVEAL_PHRASES.search(t):
        return True
    letter = item.correct_option_id
    if re.search(
        rf"\b(opcion|inciso|respuesta)\s*\(?{letter}\)?\s*(es|seria)\s*(la\s*)?correct", t
    ):
        return True
    correct_text = normalize(item.correct_option.text)
    if len(correct_text) < 12 or correct_text not in t:
        return False
    presenting_item = all(normalize(o.text) in t for o in item.options)
    return not presenting_item


def _text_of(response: LlmResponse) -> str:
    if not response.content or not response.content.parts:
        return ""
    return "".join(p.text or "" for p in response.content.parts if not getattr(p, "thought", False))


def _text_response(text: str) -> LlmResponse:
    return LlmResponse(content=types.Content(role="model", parts=[types.Part(text=text)]))


def ensure_student_in_state(callback_context: CallbackContext) -> None:
    """before_agent_callback (root): makes sure ``razona_user_id`` is in session state."""
    if callback_context.state.get(st.USER_ID):
        return None
    try:
        student = student_for_adk_user(get_repository(), callback_context.user_id)
    except Exception:  # DB down etc.: tools will report a clear error later
        logger.exception("No se pudo resolver la estudiante")
        return None
    if student:
        for key, value in initial_state(student).items():
            callback_context.state[key] = value
    return None


def require_credentials(
    callback_context: CallbackContext, llm_request: LlmRequest
) -> LlmResponse | None:
    """before_model_callback: answers with a clear Spanish message if there is no API key."""
    if get_settings().has_model_credentials:
        return None
    return _text_response(MISSING_KEY_MESSAGE)


def answer_guardrail(
    callback_context: CallbackContext, llm_response: LlmResponse
) -> LlmResponse | None:
    """after_model_callback: blocks replies that reveal the correct option while it is protected.

    Protected = items of an ungraded diagnostic, and the active practice case until the
    student answers it correctly.
    """
    text = _text_of(llm_response)
    if not text:
        return None
    ids = st.protected_item_ids(callback_context.state)
    if not ids:
        return None
    repo = get_repository()
    in_diagnostic = st.active_diagnostic(callback_context.state) is not None
    for item_id in ids:
        item = repo.get_item(item_id)
        if item is None or not reveals_answer(text, item):
            continue
        logger.warning("Guardrail: se bloqueó una respuesta que revelaba %s", item_id)
        if in_diagnostic:
            return _text_response(
                "Durante el diagnóstico no puedo dar pistas ni confirmar respuestas. "
                "Elige la opción que consideres correcta y seguimos; al calificar verás "
                "la explicación y la cita de la GPC de cada reactivo."
            )
        c = item.citation
        return _text_response(
            "No puedo darte la respuesta, pero sí ayudarte a razonarla. "
            f"Revisa {c.gpc_title}, sección «{c.section}». "
            "¿Qué dato de la viñeta crees que cambia el manejo en este caso?"
        )
    return None
