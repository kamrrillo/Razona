"""Local chat: ``python -m razona_agent.cli [--email correo | --user-id uuid]``."""

from __future__ import annotations

import argparse
import asyncio
import sys

from .config import MissingCredentialsError, require_model_credentials
from .db import DatabaseConfigError
from .session import StudentNotFoundError, create_student_session


async def _chat(email: str | None, user_id: str | None) -> None:
    from .runtime import build_runner, send_message

    runner = build_runner()
    session, student = await create_student_session(
        runner.session_service, email=email, user_id=user_id
    )
    print(f"Razona · agente ADK. Estudiante: {student.nombre or student.email} ({student.id})")
    print("Escribe tu mensaje. 'salir' para terminar.\n")
    while True:
        try:
            text = input("tú> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not text:
            continue
        if text.lower() in {"salir", "exit", "quit"}:
            break
        for reply in await send_message(runner, student.id, session.id, text):
            print(f"\n[{reply['autor']}] {reply['texto']}\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Chat local con el agente de Razona (Google ADK).")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--email", help="Correo de la estudiante (por defecto, DEMO_USER_EMAIL / Ana).")
    group.add_argument("--user-id", help="UUID de la estudiante en Supabase.")
    args = parser.parse_args(argv)
    try:
        require_model_credentials()
        asyncio.run(_chat(args.email, args.user_id))
    except MissingCredentialsError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    except (DatabaseConfigError, StudentNotFoundError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
