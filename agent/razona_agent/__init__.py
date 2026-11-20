"""Razona · sistema multiagente con Google ADK (diagnóstico + preparación ENARM).

``adk web`` (run from the ``agent/`` directory) loads ``razona_agent.root_agent``.
"""

from . import agent
from .agent import root_agent

__all__ = ["agent", "root_agent"]
