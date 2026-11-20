"""Entrypoint for Vercel (FastAPI zero-config): exposes the ASGI ``app``.

Locally use ``uv run razona-server`` (or ``python -m razona_agent.server``).
"""

from razona_agent.server import create_app

app = create_app()
