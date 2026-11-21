"""Tools of the Socratic tutor (tutor_socratico)."""

from __future__ import annotations

from google.adk.tools import ToolContext

from .. import services
from ._common import run_tool
from .preparacion import recomendar_siguiente_caso


def obtener_caso(item_id: str, tool_context: ToolContext) -> dict:
    """Carga un caso de práctica por id (sin respuesta correcta) y lo deja como caso activo.

    Args:
        item_id: Id del caso, por ejemplo 'RZ-PED-032-I'.

    Returns:
        dict con `caso`: viñeta, pregunta y opciones.
    """
    return run_tool(
        tool_context, lambda repo, uid: services.get_case(repo, tool_context.state, item_id)
    )


def buscar_gpc(item_id: str, tool_context: ToolContext, opcion: str = "") -> dict:
    """Devuelve la cita de la Guía de Práctica Clínica (GPC) del caso: id, título, sección, página y texto.

    Si la estudiante ya eligió una opción INCORRECTA, pásala en `opcion`: además de la cita
    devuelve la guía de la rúbrica para esa opción (tipo de error, pregunta socrática sugerida
    y concepto a descubrir). Úsala para guiar, no la leas literal.

    Args:
        item_id: Id del caso actual.
        opcion: Letra de la opción incorrecta que eligió la estudiante (opcional).

    Returns:
        dict con gpc_id, gpc_titulo, seccion, pagina y fragmento (tomados del banco de casos).
    """
    if opcion:
        return run_tool(
            tool_context, lambda repo, uid: services.search_gpc_for_option(repo, item_id, opcion)
        )
    return run_tool(tool_context, lambda repo, uid: services.search_gpc(repo, item_id))


def registrar_intento(item_id: str, opcion: str, tool_context: ToolContext) -> dict:
    """Registra en la base de datos la opción que eligió la estudiante en el caso (práctica con tutor).

    Args:
        item_id: Id del caso actual.
        opcion: Letra de la opción elegida (a-e).

    Returns:
        dict con es_correcta. Si es correcta incluye la explicación y la cita de la GPC;
        si es incorrecta NO incluye la respuesta.
    """
    return run_tool(
        tool_context,
        lambda repo, uid: services.register_attempt(repo, uid, tool_context.state, item_id, opcion),
    )


TUTOR_TOOLS = [obtener_caso, buscar_gpc, registrar_intento, recomendar_siguiente_caso]
