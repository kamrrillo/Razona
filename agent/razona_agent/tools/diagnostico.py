"""Tools of the diagnostic agent (agente_diagnostico)."""

from __future__ import annotations

from google.adk.tools import ToolContext

from .. import services
from ._common import run_content_tool, run_tool


def listar_especialidades() -> dict:
    """Lista las especialidades disponibles en la base de datos, con sus temas y el número de reactivos.

    Returns:
        dict con la lista `especialidades` (id, nombre, reactivos_disponibles, temas).
    """
    return run_content_tool(services.list_specialties)


def crear_examen_diagnostico(n_por_especialidad: int, tool_context: ToolContext) -> dict:
    """Crea un examen diagnóstico balanceado por especialidad con reactivos de la base de datos.

    Guarda el examen (exam_key 'diagnostico-adk') y devuelve los reactivos SIN respuestas
    correctas, explicaciones ni citas. Presenta un reactivo a la vez, en el orden recibido.

    Args:
        n_por_especialidad: Reactivos por área (1 a 5; usa 1 si la estudiante no pide otro número).

    Returns:
        dict con exam_id, total, duracion_minutos y la lista ordenada `reactivos`.
    """
    return run_tool(
        tool_context,
        lambda repo, uid: services.create_diagnostic(
            repo, uid, tool_context.state, n_por_especialidad
        ),
    )


def registrar_respuesta(item_id: str, opcion: str, tool_context: ToolContext) -> dict:
    """Registra (o corrige) la respuesta de la estudiante a un reactivo del diagnóstico activo.

    No indica si la respuesta es correcta. Devuelve el siguiente reactivo pendiente, si existe.

    Args:
        item_id: Id del reactivo respondido (campo `id` del reactivo).
        opcion: Letra de la opción elegida por la estudiante (a-e).

    Returns:
        dict con respondidas, total y `siguiente_reactivo` (o null si ya respondió todos).
    """
    return run_tool(
        tool_context,
        lambda repo, uid: services.register_answer(repo, uid, tool_context.state, item_id, opcion),
    )


def calificar_diagnostico(tool_context: ToolContext) -> dict:
    """Termina y califica el diagnóstico activo.

    Devuelve calificación, desglose por especialidad y por tema, temas débiles y la revisión
    de cada reactivo con su explicación y la cita de la GPC (todo tomado de la base de datos).

    Returns:
        dict con score, correct, total, by_specialty, by_topic, weak_topics, overall_weak_topic y review.
    """
    return run_tool(
        tool_context,
        lambda repo, uid: services.grade_diagnostic(repo, uid, tool_context.state),
    )


DIAGNOSTIC_TOOLS = [
    listar_especialidades,
    crear_examen_diagnostico,
    registrar_respuesta,
    calificar_diagnostico,
]
