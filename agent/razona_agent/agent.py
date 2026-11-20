"""Agent tree: coordinador (root) -> agente_diagnostico, agente_preparacion, tutor_socratico.

The coordinator routes with ADK's agent transfer (sub_agents). Every agent shares:
- before_model_callback ``require_credentials`` (clear Spanish error without API key),
- after_model_callback ``answer_guardrail`` (blocks replies revealing a protected answer).
The root also resolves the student into session state (``ensure_student_in_state``).
"""

from __future__ import annotations

from google.adk.agents import LlmAgent
from google.adk.models.base_llm import BaseLlm
from google.genai import types

from .callbacks import answer_guardrail, ensure_student_in_state, require_credentials
from .config import get_settings
from .prompts import (
    COORDINATOR_INSTRUCTION,
    DIAGNOSTIC_INSTRUCTION,
    PREP_INSTRUCTION,
    TUTOR_INSTRUCTION,
    WEB_DIAGNOSTIC_NOTE,
)
from .tools import DIAGNOSTIC_TOOLS, PREP_TOOLS, TUTOR_TOOLS


def _config(temperature: float) -> types.GenerateContentConfig:
    return types.GenerateContentConfig(temperature=temperature)


def _common(model: str | BaseLlm | None) -> dict:
    model = model or get_settings().model
    before_model = [require_credentials] if isinstance(model, str) else []
    return {
        "model": model,
        "before_model_callback": before_model,
        "after_model_callback": answer_guardrail,
    }


def _diagnostic_agent(common: dict, instruction: str = DIAGNOSTIC_INSTRUCTION) -> LlmAgent:
    return LlmAgent(
        name="agente_diagnostico",
        description=(
            "Aplica un examen diagnóstico balanceado por especialidad con reactivos de la base de "
            "datos, un reactivo a la vez y sin pistas; al final califica y muestra explicaciones y "
            "citas de la GPC."
        ),
        instruction=instruction,
        tools=DIAGNOSTIC_TOOLS,
        generate_content_config=_config(0.2),
        **common,
    )


def build_web_diagnostic_agent(model: str | BaseLlm | None = None) -> LlmAgent:
    """Standalone diagnostic agent for the web app (the UI renders items and records answers)."""
    return _diagnostic_agent(_common(model), DIAGNOSTIC_INSTRUCTION + WEB_DIAGNOSTIC_NOTE)


def build_root_agent(model: str | BaseLlm | None = None) -> LlmAgent:
    """Builds the agent tree. ``model`` defaults to GEMINI_MODEL (or ADK's default flash model).

    Pass a ``BaseLlm`` instance (e.g. a fake) to run without Gemini; the credentials
    check is only attached when the model is a Gemini model name.
    """
    common = _common(model)

    diagnostico = _diagnostic_agent(common)
    preparacion = LlmAgent(
        name="agente_preparacion",
        description=(
            "Muestra progreso, racha y tema débil, recomienda el siguiente caso (Thompson sampling) "
            "y arma un plan de estudio a partir de las estadísticas."
        ),
        instruction=PREP_INSTRUCTION,
        tools=PREP_TOOLS,
        generate_content_config=_config(0.3),
        **common,
    )
    tutor = LlmAgent(
        name="tutor_socratico",
        description=(
            "Tutor socrático para casos clínicos de práctica: nunca da la respuesta, hace una "
            "pregunta socrática y siempre cita la GPC."
        ),
        instruction=TUTOR_INSTRUCTION,
        tools=TUTOR_TOOLS,
        generate_content_config=_config(0.4),
        **common,
    )
    return LlmAgent(
        name="coordinador",
        description="Coordinador de Razona: saluda y deriva al especialista adecuado.",
        instruction=COORDINATOR_INSTRUCTION,
        sub_agents=[diagnostico, preparacion, tutor],
        before_agent_callback=ensure_student_in_state,
        generate_content_config=_config(0.3),
        **common,
    )


root_agent = build_root_agent()
