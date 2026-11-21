"""Thin FastAPI server: ``python -m razona_agent.server`` (puerto 8080 por defecto).

Autenticación: si AGENT_API_TOKEN está definido, todos los endpoints excepto /salud exigen
``Authorization: Bearer <AGENT_API_TOKEN>`` (la app web lo envía desde el servidor).

Endpoints:
- GET  /salud
- POST /sesiones                         {"email"?: str, "user_id"?: str} -> session_id, user_id
- POST /sesiones/{session_id}/mensajes   {"user_id": str, "texto": str} -> respuestas

Diagnóstico para la app web (ver razona_agent/web_diagnostic.py):
- POST /diagnostico/sesiones                           {"user_id", "n_por_especialidad"?}
- POST /diagnostico/sesiones/{id}/respuestas           {"user_id", "item_id", "opcion"}
- POST /diagnostico/sesiones/{id}/mensajes             {"user_id", "texto"}
- POST /diagnostico/sesiones/{id}/calificar            {"user_id"}
Todas devuelven {session_id, agente_disponible, estado, respuestas}.

For ADK's own dev API/UI use ``adk api_server`` / ``adk web`` from the agent/ directory.
"""

from __future__ import annotations

import argparse
import hmac
import sys

from fastapi import Depends, FastAPI, Header, HTTPException
from google.adk.runners import Runner
from pydantic import BaseModel, Field

from .config import MissingCredentialsError, get_settings, require_model_credentials
from .db import DatabaseConfigError
from .session import StudentNotFoundError, create_student_session


class NewSession(BaseModel):
    email: str | None = None
    user_id: str | None = None


class NewMessage(BaseModel):
    user_id: str
    texto: str


class DiagnosticStart(BaseModel):
    user_id: str
    n_por_especialidad: int = Field(default=1, ge=1, le=5)  # por área


class DiagnosticAnswer(BaseModel):
    user_id: str
    item_id: str = Field(min_length=1, max_length=120)
    opcion: str = Field(pattern=r"^[a-eA-E]$")


class DiagnosticMessage(BaseModel):
    user_id: str
    texto: str = Field(min_length=1, max_length=1000)


class DiagnosticUser(BaseModel):
    user_id: str


def require_token(authorization: str | None = Header(default=None)) -> None:
    """If AGENT_API_TOKEN is configured, requires ``Authorization: Bearer <token>``."""
    expected = get_settings().agent_api_token
    if not expected:
        return
    given = (authorization or "").removeprefix("Bearer ").strip()
    if not hmac.compare_digest(given.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Token inválido.")


def create_app(runner: Runner | None = None, diagnostic_runner: Runner | None = None) -> FastAPI:
    app = FastAPI(title="Razona · agente ADK", version="0.1.0")
    state: dict[str, Runner] = {}
    auth = [Depends(require_token)]

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

    def get_diagnostic_runner() -> Runner:
        if "diagnostic" not in state:
            from .agent import build_web_diagnostic_agent
            from .runtime import build_runner

            state["diagnostic"] = diagnostic_runner or build_runner(build_web_diagnostic_agent())
        return state["diagnostic"]

    async def run_diagnostic(fn, *args):
        from .db import get_repository
        from .web_diagnostic import DiagnosticError

        try:
            return await fn(get_diagnostic_runner(), get_repository(), *args)
        except (LookupError, StudentNotFoundError) as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except DiagnosticError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except DatabaseConfigError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    @app.post("/diagnostico/sesiones", dependencies=auth)
    async def diagnostico_iniciar(body: DiagnosticStart) -> dict:
        from . import web_diagnostic as wd

        return await run_diagnostic(wd.start, body.user_id, body.n_por_especialidad)

    @app.post("/diagnostico/sesiones/{session_id}/respuestas", dependencies=auth)
    async def diagnostico_responder(session_id: str, body: DiagnosticAnswer) -> dict:
        from . import web_diagnostic as wd

        return await run_diagnostic(
            wd.answer, body.user_id, session_id, body.item_id, body.opcion.lower()
        )

    @app.post("/diagnostico/sesiones/{session_id}/mensajes", dependencies=auth)
    async def diagnostico_mensaje(session_id: str, body: DiagnosticMessage) -> dict:
        from . import web_diagnostic as wd

        return await run_diagnostic(wd.message, body.user_id, session_id, body.texto)

    @app.post("/diagnostico/sesiones/{session_id}/calificar", dependencies=auth)
    async def diagnostico_calificar(session_id: str, body: DiagnosticUser) -> dict:
        from . import web_diagnostic as wd

        return await run_diagnostic(wd.grade, body.user_id, session_id)

    @app.post("/sesiones", dependencies=auth)
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

    @app.post("/sesiones/{session_id}/mensajes", dependencies=auth)
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
        # The web diagnostic still works without Gemini (no narration); chat endpoints return 503.
        print(f"Aviso: {exc}\n\nEl servidor arranca sin el agente conversacional.", file=sys.stderr)
    if not get_settings().agent_api_token:
        print("Aviso: AGENT_API_TOKEN no está definido; el servidor no exige token.", file=sys.stderr)
    import uvicorn

    uvicorn.run(create_app(), host=args.host, port=args.port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
