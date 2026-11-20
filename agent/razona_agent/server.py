"""Thin FastAPI server: ``python -m razona_agent.server`` (puerto 8080 por defecto).

Endpoints (demo local, sin autenticación — agrega auth antes de exponerlo):
- GET  /salud
- POST /sesiones                         {"email"?: str, "user_id"?: str} -> session_id, user_id
- POST /sesiones/{session_id}/mensajes   {"user_id": str, "texto": str} -> respuestas

For ADK's own dev API/UI use ``adk api_server`` / ``adk web`` from the agent/ directory.
"""

from __future__ import annotations

import argparse
import sys

from fastapi import FastAPI, HTTPException
from google.adk.runners import Runner
from pydantic import BaseModel

from .config import MissingCredentialsError, get_settings, require_model_credentials
from .db import DatabaseConfigError
from .session import StudentNotFoundError, create_student_session


class NewSession(BaseModel):
    email: str | None = None
    user_id: str | None = None


class NewMessage(BaseModel):
    user_id: str
    texto: str


def create_app(runner: Runner | None = None) -> FastAPI:
    app = FastAPI(title="Razona · agente ADK", version="0.1.0")
    state: dict[str, Runner] = {}

    def get_runner() -> Runner:
        if "runner" not in state:
            from .runtime import build_runner

            state["runner"] = runner or build_runner()
        return state["runner"]

    @app.get("/salud")
    def salud() -> dict:
        s = get_settings()
        return {
            "ok": True,
            "modelo": s.model,
            "credenciales_gemini": s.has_model_credentials,
            "supabase": bool(s.supabase_url and s.supabase_secret_key),
        }

    @app.post("/sesiones")
    async def crear_sesion(body: NewSession) -> dict:
        try:
            session, student = await create_student_session(
                get_runner().session_service, email=body.email, user_id=body.user_id
            )
        except StudentNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except DatabaseConfigError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        return {"session_id": session.id, "user_id": student.id, "nombre": student.nombre}

    @app.post("/sesiones/{session_id}/mensajes")
    async def enviar_mensaje(session_id: str, body: NewMessage) -> dict:
        from .runtime import send_message

        try:
            require_model_credentials()
        except MissingCredentialsError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        r = get_runner()
        session = await r.session_service.get_session(
            app_name=r.app_name, user_id=body.user_id, session_id=session_id
        )
        if session is None:
            raise HTTPException(status_code=404, detail="Sesión no encontrada.")
        return {"respuestas": await send_message(r, body.user_id, session_id, body.texto)}

    return app


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Servidor FastAPI del agente de Razona.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args(argv)
    try:
        require_model_credentials()
    except MissingCredentialsError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    import uvicorn

    uvicorn.run(create_app(), host=args.host, port=args.port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
