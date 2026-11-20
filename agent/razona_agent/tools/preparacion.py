"""Tools of the study-prep agent (agente_preparacion)."""

from __future__ import annotations

from google.adk.tools import ToolContext

from .. import services
from ._common import run_tool


def obtener_progreso(tool_context: ToolContext) -> dict:
    """Obtiene el progreso de la estudiante: totales, racha, avance por especialidad y por tema,
    tema débil y exámenes recientes (práctica + exámenes terminados).

    Returns:
        dict con nombre, totals_answered, totals_correct, answered_today, streak, by_specialty,
        by_topic (dominio = media posterior Beta), weak_topic y recent_exams.
    """
    return run_tool(tool_context, services.get_progress)


def obtener_tema_debil(tool_context: ToolContext) -> dict:
    """Obtiene el tema débil: el de menor dominio entre los temas con al menos 3 respuestas.

    Returns:
        dict con `tema_debil` (tema, especialidad, aciertos, total, dominio) o null.
    """
    return run_tool(tool_context, services.get_weak_topic)


def recomendar_siguiente_caso(tema: str, tool_context: ToolContext) -> dict:
    """Recomienda el siguiente caso de práctica y lo deja como caso activo.

    Args:
        tema: Vacío para elegir con Thompson sampling según el desempeño; 'debil' para el tema
            débil; o el nombre exacto de un tema.

    Returns:
        dict con motivo, explicacion_motivo, dominio_actual y `caso` (sin respuesta correcta).
    """
    return run_tool(
        tool_context,
        lambda repo, uid: services.recommend_next_case(repo, uid, tool_context.state, tema),
    )


def generar_plan_estudio(dias: int, tool_context: ToolContext) -> dict:
    """Genera un plan de estudio determinista a partir de las estadísticas de la estudiante.

    Prioriza el tema débil, luego temas en progreso, luego temas nuevos y al final repasos;
    con 3 días o más, el último día es un simulacro diagnóstico.

    Args:
        dias: Número de días del plan (1 a 30; usa 7 si la estudiante no indica otro).

    Returns:
        dict con days, start_date, weak_topic, priority_topics y `schedule` (un objeto por día).
    """
    return run_tool(
        tool_context, lambda repo, uid: services.generate_study_plan(repo, uid, dias)
    )


PREP_TOOLS = [obtener_progreso, obtener_tema_debil, recomendar_siguiente_caso, generar_plan_estudio]
