"""Student resolution and session creation.

How the user id gets into session state:

* CLI / FastAPI server: :func:`create_student_session` resolves the student by
  email or uuid (default: the demo user, Ana) and creates the ADK session with
  ``state={"razona_user_id": <uuid>, "razona_nombre": ..., "razona_email": ...}``.
  The ADK ``user_id`` of the session is the student's uuid.
* ``adk web`` / ``adk api_server``: sessions are created by ADK without our state,
  so the root agent's ``before_agent_callback`` (:func:`ensure_student_in_state`)
  resolves the student from the ADK user id (uuid or email) and, if it is neither
  (``adk web`` uses "user"), falls back to ``DEMO_USER_EMAIL`` when
  ``RAZONA_DEMO_FALLBACK`` is on (default).
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from . import state as st
from .config import APP_NAME, Settings, get_settings
from .db import RazonaRepository, get_repository, is_uuid


class Student(BaseModel):
    id: str
    nombre: str
    email: str | None = None


class StudentNotFoundError(LookupError):
    pass


def resolve_student(
    repo: RazonaRepository,
    email: str | None = None,
    user_id: str | None = None,
    settings: Settings | None = None,
) -> Student:
    """Finds the student by uuid or email; with neither, uses the demo user (Ana)."""
    settings = settings or get_settings()
    if user_id:
        if not is_uuid(user_id):
            raise StudentNotFoundError(f"'{user_id}' no es un uuid válido.")
        profile = repo.get_profile(user_id)
        if not profile:
            raise StudentNotFoundError(f"No existe un perfil con id {user_id}.")
        return Student(id=user_id, nombre=profile.get("display_name") or "", email=email)

    email = (email or settings.demo_user_email).strip()
    found = repo.find_user_id_by_email(email)
    if not found:
        raise StudentNotFoundError(
            f"No existe el usuario {email}. Para la demo local corre `pnpm seed:demo`."
        )
    profile = repo.get_profile(found) or {}
    return Student(id=found, nombre=profile.get("display_name") or "", email=email)


def initial_state(student: Student) -> dict[str, Any]:
    return {
        st.USER_ID: student.id,
        st.USER_NAME: student.nombre,
        st.USER_EMAIL: student.email or "",
    }


async def create_student_session(
    session_service: Any,
    *,
    email: str | None = None,
    user_id: str | None = None,
    app_name: str = APP_NAME,
    repo: RazonaRepository | None = None,
    session_id: str | None = None,
):
    """Creates an ADK session whose state carries the student's id. Returns (session, student)."""
    student = resolve_student(repo or get_repository(), email=email, user_id=user_id)
    session = await session_service.create_session(
        app_name=app_name,
        user_id=student.id,
        state=initial_state(student),
        session_id=session_id,
    )
    return session, student


def student_for_adk_user(
    repo: RazonaRepository, adk_user_id: str, settings: Settings | None = None
) -> Student | None:
    """Maps an ADK user id (uuid, email or anything else) to a student."""
    settings = settings or get_settings()
    try:
        if is_uuid(adk_user_id):
            return resolve_student(repo, user_id=adk_user_id, settings=settings)
        if "@" in (adk_user_id or ""):
            return resolve_student(repo, email=adk_user_id, settings=settings)
        if settings.demo_fallback:
            return resolve_student(repo, settings=settings)
    except StudentNotFoundError:
        return None
    return None
