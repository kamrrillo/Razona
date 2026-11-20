import pytest
from fastapi.testclient import TestClient

from razona_agent.config import get_settings
from razona_agent.server import create_app

pytestmark = pytest.mark.integration


def test_server_sessions_and_missing_key(ana):
    token = get_settings().agent_api_token
    client = TestClient(create_app(), headers={"Authorization": f"Bearer {token}"} if token else {})
    health = client.get("/salud").json()
    assert health["ok"] and health["supabase"] and health["credenciales_gemini"] is False

    created = client.post("/sesiones", json={}).json()  # default: demo user (Ana)
    assert created["user_id"] == ana.id and created["nombre"] == "Ana"
    assert client.post("/sesiones", json={"email": "nadie@razona.app"}).status_code == 404

    res = client.post(
        f"/sesiones/{created['session_id']}/mensajes", json={"user_id": ana.id, "texto": "Hola"}
    )
    assert res.status_code == 503 and "GOOGLE_API_KEY" in res.json()["detail"]
