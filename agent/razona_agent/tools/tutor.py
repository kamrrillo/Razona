"""Tools of the Socratic tutor (tutor_socratico)."""

from __future__ import annotations

from google.adk.tools import ToolContext

from .. import services
from ._common import run_tool
from .preparacion import recomendar_siguiente_caso


def obtener_caso(item_id: str, tool_context: ToolContext) -> dict:
    """Carga un caso de práctica por id (sin respuesta correcta) y lo deja como caso activo.

    Args:
        item_id: Id del caso, por ejemplo 'caso-bronquiolitis-01'.

    Returns:
        dict con `caso`: viñeta, pregunta y opciones.
    """
    return run_tool(
        tool_context, lambda repo, uid: services.get_case(repo, tool_context.state, item_id)
    )


def buscar_gpc(item_id: str, tool_context: ToolContext) -> dict:
    """Devuelve el fragmento de la Guía de Práctica Clínica (GPC) del caso: id, título, sección y texto.

    Args:
        item_id: Id del caso actual.

    Returns:
        dict con gpc_id, gpc_titulo, seccion y fragmento (tomados de la base de datos).
    """
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
