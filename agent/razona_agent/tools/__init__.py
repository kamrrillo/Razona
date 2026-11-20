"""FunctionTools grouped by agent (plain functions; ADK wraps them as FunctionTool)."""

from .diagnostico import DIAGNOSTIC_TOOLS
from .preparacion import PREP_TOOLS
from .tutor import TUTOR_TOOLS

__all__ = ["DIAGNOSTIC_TOOLS", "PREP_TOOLS", "TUTOR_TOOLS"]
