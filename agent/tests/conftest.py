"""Shared fixtures. Tests never call Gemini; they run without any API key."""

from __future__ import annotations

import os

import pytest

# Make sure no test can reach Gemini even if the developer has a key exported.
for _key in ("GOOGLE_API_KEY", "GOOGLE_GENAI_API_KEY", "GEMINI_API_KEY"):
    os.environ.pop(_key, None)
os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "FALSE"


@pytest.fixture(scope="session")
def repo():
    from razona_agent.db import get_repository

    try:
        r = get_repository()
        r.list_specialties()
    except Exception as exc:  # pragma: no cover - only when Supabase is down
        pytest.skip(f"Supabase local no disponible: {exc}")
    return r


@pytest.fixture(scope="session")
def ana(repo):
    from razona_agent.session import resolve_student

    return resolve_student(repo)


@pytest.fixture
def ana_state(ana):
    from razona_agent.session import initial_state

    return initial_state(ana)


@pytest.fixture
def snapshot(repo, ana):
    """Asserts Ana's history is unchanged after the test (tests clean up after themselves)."""

    def take():
        outcomes = repo.load_outcomes(ana.id)
        return (len(outcomes), sum(o.is_correct for o in outcomes), len(repo.recent_exams(ana.id, 50)))

    before = take()
    yield
    assert take() == before, "La prueba dejó filas en el historial de Ana"
