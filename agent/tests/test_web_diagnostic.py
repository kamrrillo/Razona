"""Web diagnostic flow (endpoints used by the Next.js app), against local Supabase, without Gemini."""

import pytest
from fastapi.testclient import TestClient

from razona_agent.config import get_settings
from razona_agent.server import create_app

pytestmark = pytest.mark.integration


def _headers() -> dict:
    token = get_settings().agent_api_token
    return {"Authorization": f"Bearer {token}"} if token else {}


def test_full_diagnostic_flow(repo, ana, snapshot):
    client = TestClient(create_app())
    h = _headers()

    started = client.post("/diagnostico/sesiones", json={"user_id": ana.id}, headers=h)
    assert started.status_code == 200, started.text
    body = started.json()
    sid, estado = body["session_id"], body["estado"]
    exam_id = estado["exam_id"]
    try:
        assert body["agente_disponible"] is False and body["respuestas"] == []
        assert estado["respondidas"] == 0 and not estado["finalizado"]
        current = estado["reactivo_actual"]
        assert current["numero"] == 1 and "correct_option_id" not in current
        assert "explanation" not in current and "citation" not in current

        # Another student cannot use this session.
        other = client.post(
            f"/diagnostico/sesiones/{sid}/respuestas",
            json={"user_id": "00000000-0000-4000-8000-000000000999", "item_id": current["id"], "opcion": "a"},
            headers=h,
        )
        assert other.status_code == 404

        # Invalid item -> 400.
        bad = client.post(
            f"/diagnostico/sesiones/{sid}/respuestas",
            json={"user_id": ana.id, "item_id": "no-existe", "opcion": "a"},
            headers=h,
        )
        assert bad.status_code == 400

        # Answer every item with "a".
        while estado["reactivo_actual"]:
            res = client.post(
                f"/diagnostico/sesiones/{sid}/respuestas",
                json={"user_id": ana.id, "item_id": estado["reactivo_actual"]["id"], "opcion": "A"},
                headers=h,
            )
            assert res.status_code == 200, res.text
            estado = res.json()["estado"]
            assert estado["resultado"] is None
        assert estado["respondidas"] == estado["total"] and all(r["respondido"] for r in estado["reactivos"])

        # Chat without Gemini: no narration, flow continues.
        msg = client.post(
            f"/diagnostico/sesiones/{sid}/mensajes", json={"user_id": ana.id, "texto": "¿Acerté?"}, headers=h
        )
        assert msg.status_code == 200 and msg.json()["respuestas"] == []

        graded = client.post(f"/diagnostico/sesiones/{sid}/calificar", json={"user_id": ana.id}, headers=h)
        assert graded.status_code == 200, graded.text
        estado = graded.json()["estado"]
        result = estado["resultado"]
        assert estado["finalizado"] and estado["reactivo_actual"] is None
        assert result["total"] == estado["total"] and result["answered"] == estado["total"]
        assert all(r["citation"]["gpc_id"] for r in result["review"])

        # Grading again is idempotent; answering after grading is rejected.
        again = client.post(f"/diagnostico/sesiones/{sid}/calificar", json={"user_id": ana.id}, headers=h)
        assert again.json()["estado"]["resultado"]["score"] == result["score"]
        late = client.post(
            f"/diagnostico/sesiones/{sid}/respuestas",
            json={"user_id": ana.id, "item_id": result["review"][0]["item_id"], "opcion": "b"},
            headers=h,
        )
        assert late.status_code == 400
    finally:
        repo.delete_exam(ana.id, exam_id)


def test_token_required_when_configured(monkeypatch, ana):
    from razona_agent import config

    settings = config.get_settings().model_copy(update={"agent_api_token": "secreto-de-prueba"})
    monkeypatch.setattr(config, "get_settings", lambda: settings)
    monkeypatch.setattr("razona_agent.server.get_settings", lambda: settings)
    client = TestClient(create_app())
    assert client.get("/salud").status_code == 200
    assert client.post("/diagnostico/sesiones", json={"user_id": ana.id}).status_code == 401
    wrong = {"Authorization": "Bearer otro"}
    assert client.post("/sesiones", json={}, headers=wrong).status_code == 401


def test_agent_narrates_and_guardrail_protects_items(monkeypatch, repo, ana, snapshot):
    """With a (fake) model available, the web diagnostic agent narrates; the guardrail still applies."""
    import asyncio

    from razona_agent import web_diagnostic as wd
    from razona_agent.agent import build_web_diagnostic_agent
    from razona_agent.runtime import build_runner
    from tests.test_runner_mock import ScriptedLlm, _call, _text

    monkeypatch.setattr(wd, "agent_available", lambda: True)

    async def flow():
        llm = ScriptedLlm(model="fake-llm", script=[], requests=[])
        runner = build_runner(build_web_diagnostic_agent(llm))
        llm.script.append(_text("¡Hola, Ana! Responde cada reactivo con los botones."))
        started = await wd.start(runner, repo, ana.id, 1)
        sid, exam_id = started["session_id"], started["estado"]["exam_id"]
        try:
            assert started["respuestas"][0]["texto"].startswith("¡Hola, Ana!")
            instruction = str(llm.requests[0].config.system_instruction)
            assert "La interfaz ya muestra" in instruction or "interfaz muestra" in instruction

            item = repo.get_item(started["estado"]["reactivo_actual"]["id"])
            llm.script.append(_text(f"La respuesta correcta es la {item.correct_option_id}."))
            leaked = await wd.message(runner, repo, ana.id, sid, "¿Cuál es la correcta?")
            assert "no puedo dar pistas" in leaked["respuestas"][0]["texto"].lower()

            llm.script += [_call("calificar_diagnostico"), _text("Obtuviste tu calificación.")]
            graded = await wd.grade(runner, repo, ana.id, sid)
            assert graded["estado"]["finalizado"]
            assert graded["respuestas"][-1]["texto"] == "Obtuviste tu calificación."
        finally:
            repo.delete_exam(ana.id, exam_id)

    asyncio.run(flow())
