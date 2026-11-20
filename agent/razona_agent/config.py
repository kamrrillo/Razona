"""Settings and environment loading.

Order of precedence for every variable:
1. Real process environment.
2. ``agent/.env`` (the package's own env file; also loaded by ``adk web``).
3. ``../.env.local`` (the Next.js app's env file) — only for the Supabase vars,
   the demo user email and ``GOOGLE_GENAI_API_KEY``, so local dev works out of the box.

Nothing here requires a Gemini API key: importing the package, the tools, the DB
layer and the tests all work without one. Only the CLI/server (and model calls)
check for credentials via :func:`require_model_credentials`.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import dotenv_values
from pydantic import BaseModel

AGENT_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = AGENT_DIR.parent
PACKAGE_ENV_FILE = AGENT_DIR / ".env"
REPO_ENV_FILE = REPO_DIR / ".env.local"

APP_NAME = "razona_agent"
"""ADK app name. Must match the package directory so `adk web` and our runners agree."""

DEFAULT_MODEL = "gemini-3.5-flash"
"""Default model documented by google-adk 2.15 (``LlmAgent.DEFAULT_MODEL``)."""

DEFAULT_DEMO_EMAIL = "ana.demo@razona.app"

# Variables taken from the Next.js app's .env.local when missing here.
_REPO_FALLBACK_KEYS = {
    "SUPABASE_URL": ("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    "SUPABASE_SECRET_KEY": ("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
    "DEMO_USER_EMAIL": ("DEMO_USER_EMAIL",),
    "GOOGLE_GENAI_API_KEY": ("GOOGLE_GENAI_API_KEY",),
    "AGENT_API_TOKEN": ("AGENT_API_TOKEN",),
}

MISSING_KEY_MESSAGE = (
    "Falta la clave de Gemini. Define GOOGLE_API_KEY (o su alias GOOGLE_GENAI_API_KEY) "
    "en agent/.env o en tu terminal, por ejemplo:\n\n"
    "    export GOOGLE_API_KEY=tu-clave   # https://aistudio.google.com/apikey\n\n"
    "Si usas Vertex AI, define GOOGLE_GENAI_USE_VERTEXAI=TRUE, "
    "GOOGLE_CLOUD_PROJECT y GOOGLE_CLOUD_LOCATION."
)


class MissingCredentialsError(RuntimeError):
    """Raised (with a Spanish message) when no Gemini credentials are configured."""


class Settings(BaseModel):
    supabase_url: str | None = None
    supabase_secret_key: str | None = None
    database_url: str | None = None
    google_api_key: str | None = None
    use_vertexai: bool = False
    model: str = DEFAULT_MODEL
    demo_user_email: str = DEFAULT_DEMO_EMAIL
    agent_api_token: str | None = None
    """Shared secret with the web app (Authorization: Bearer). If set, the server requires it."""
    demo_fallback: bool = True
    """If the ADK user id is not an email/uuid (e.g. `adk web` uses "user"), act as the demo user."""

    @property
    def has_model_credentials(self) -> bool:
        return bool(self.google_api_key) or self.use_vertexai


def _truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "si", "sí"}


def _read_env_file(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    return {k: v for k, v in dotenv_values(path).items() if v not in (None, "")}


def load_settings(
    environ: dict[str, str] | None = None,
    package_env_file: Path | None = PACKAGE_ENV_FILE,
    repo_env_file: Path | None = REPO_ENV_FILE,
) -> Settings:
    """Builds settings from the environment and the env files (pure; no side effects)."""
    env = dict(os.environ if environ is None else environ)
    package_env = _read_env_file(package_env_file) if package_env_file else {}
    repo_env = _read_env_file(repo_env_file) if repo_env_file else {}

    def get(name: str) -> str | None:
        value = env.get(name) or package_env.get(name)
        if value:
            return value
        for alias in _REPO_FALLBACK_KEYS.get(name, ()):
            if repo_env.get(alias):
                return repo_env[alias]
        return None

    return Settings(
        supabase_url=get("SUPABASE_URL"),
        supabase_secret_key=get("SUPABASE_SECRET_KEY") or get("SUPABASE_SERVICE_ROLE_KEY"),
        database_url=get("DATABASE_URL"),
        google_api_key=get("GOOGLE_API_KEY") or get("GOOGLE_GENAI_API_KEY") or get("GEMINI_API_KEY"),
        use_vertexai=_truthy(get("GOOGLE_GENAI_USE_VERTEXAI")),
        model=get("GEMINI_MODEL") or DEFAULT_MODEL,
        demo_user_email=get("DEMO_USER_EMAIL") or DEFAULT_DEMO_EMAIL,
        agent_api_token=get("AGENT_API_TOKEN"),
        demo_fallback=get("RAZONA_DEMO_FALLBACK") is None or _truthy(get("RAZONA_DEMO_FALLBACK")),
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Process-wide settings. Also exports GOOGLE_API_KEY so google-genai finds the alias."""
    settings = load_settings()
    if settings.google_api_key and not os.environ.get("GOOGLE_API_KEY"):
        # google-genai only reads GOOGLE_API_KEY / GEMINI_API_KEY; map the alias.
        os.environ["GOOGLE_API_KEY"] = settings.google_api_key
    if not os.environ.get("GOOGLE_GENAI_USE_VERTEXAI"):
        os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "TRUE" if settings.use_vertexai else "FALSE"
    return settings


def require_model_credentials(settings: Settings | None = None) -> Settings:
    """Raises MissingCredentialsError with a clear Spanish message if there is no key."""
    settings = settings or get_settings()
    if not settings.has_model_credentials:
        raise MissingCredentialsError(MISSING_KEY_MESSAGE)
    return settings
