"""Tool functions against the local Supabase, as Ana. Every test cleans up its rows."""

import pytest

from razona_agent import state as st
from razona_agent.tools.diagnostico import (
    calificar_diagnostico,
    crear_examen_diagnostico,
    listar_especialidades,
    registrar_respuesta,
)
from razona_agent.tools.preparacion import (
    generar_plan_estudio,
    obtener_progreso,
    obtener_tema_debil,
    recomendar_siguiente_caso,
)
from razona_agent.tools.tutor import buscar_gpc, obtener_caso, registrar_intento


pytestmark = pytest.mark.integration


class Ctx:
    """Minimal stand-in for ADK's ToolContext: the tools only use ``.state``."""

    def __init__(self, state):
        self.state = state


def test_tools_require_user_in_state():
    result = obtener_progreso(Ctx({}))
    assert "error" in result and "razona_user_id" in result["error"]


def test_listar_especialidades(repo):
    data = listar_especialidades()
    assert [e["id"] for e in data["especialidades"]] == [s.id for s in repo.list_specialties()]
    assert all(e["reactivos_disponibles"] > 0 for e in data["especialidades"])


def test_full_diagnostic_flow(repo, ana, ana_state, snapshot):
    ctx = Ctx(ana_state)
    created = crear_examen_diagnostico(2, ctx)
    exam_id = created["exam_id"]
    try:
        items = created["reactivos"]
        specialties = {s.id for s in repo.list_specialties()}
        assert created["total"] == len(items) == 2 * len(specialties)
        assert {i["specialty_id"] for i in items} == specialties
        assert all("correct_option_id" not in i and "explanation" not in i for i in items)
        exam = repo.get_exam(ana.id, exam_id)
        assert exam.exam_key == "diagnostico-adk" and exam.finished_at is None
        assert ctx.state[st.ACTIVE_EXAM] == exam_id

        # answer: first correct, second wrong, the rest unanswered
        first, second = (repo.get_item(i["id"]) for i in items[:2])
        wrong = next(o.id for o in second.options if o.id != second.correct_option_id)
        r1 = registrar_respuesta(first.id, f"{first.correct_option_id.upper()})", ctx)
        assert r1["registrada"] and r1["respondidas"] == 1
        assert "es_correcta" not in r1 and "is_correct" not in r1  # no feedback during diagnostic
        assert r1["siguiente_reactivo"]["id"] == second.id
        r2 = registrar_respuesta(second.id, wrong, ctx)
        assert r2["respondidas"] == 2
        assert "error" in registrar_respuesta(second.id, "z", ctx)
        assert "error" in registrar_respuesta("no-existe", "a", ctx)
        # tutor is off while the diagnostic is open
        assert "error" in registrar_intento("caso-bronquiolitis-01", "a", ctx)

        graded = calificar_diagnostico(ctx)
        assert (graded["correct"], graded["answered"], graded["total"]) == (1, 2, len(items))
        assert graded["score"] == round(100 / len(items), 2)
        assert {t["topic"] for t in graded["weak_topics"]} == {second.topic}
        review = {r["item_id"]: r for r in graded["review"]}
        assert review[second.id]["selected_option"] == wrong
        assert review[second.id]["explanation"] == second.explanation
        assert review[second.id]["citation"]["gpc_id"] == second.citation.gpc_id
        assert graded["overall_weak_topic"] is not None

        exam = repo.get_exam(ana.id, exam_id)
        assert exam.finished_at and exam.correct == 1 and exam.total == len(items)
        assert ctx.state[st.DIAGNOSTIC]["finalizado"] and ctx.state[st.ACTIVE_EXAM] is None
        assert "error" in registrar_respuesta(first.id, "a", ctx)  # closed
    finally:
        repo.delete_exam(ana.id, exam_id)


def test_progress_and_weak_topic_for_ana(ana_state):
    ctx = Ctx(ana_state)
    progress = obtener_progreso(ctx)
    assert progress["nombre"] == "Ana"
    assert progress["totals_answered"] >= 50
    assert progress["streak"]["current"] >= 1
    assert len(progress["by_specialty"]) == 4
    weak = obtener_tema_debil(ctx)["tema_debil"]
    assert weak["topic"] == "Bronquiolitis" and weak["has_case"] is True


def test_recommend_case_weak_and_thompson(ana_state):
    ctx = Ctx(ana_state)
    weak = recomendar_siguiente_caso("debil", ctx)
    assert weak["motivo"] == "debil" and weak["caso"]["topic"] == "Bronquiolitis"
    assert ctx.state[st.ACTIVE_CASE] == weak["caso"]["id"]
    assert "correct_option_id" not in weak["caso"]
    a = recomendar_siguiente_caso("", ctx)
    b = recomendar_siguiente_caso("", ctx)
    assert a["motivo"] == "thompson" and a["caso"]["id"] == b["caso"]["id"]  # deterministic seed
    assert recomendar_siguiente_caso("Apendicitis aguda", ctx)["motivo"] == "tema"


def test_study_plan_from_db(ana_state):
    plan = generar_plan_estudio(5, Ctx(ana_state))
    assert plan["days"] == 5 and len(plan["schedule"]) == 5
    assert plan["weak_topic"] == "Bronquiolitis"
    assert plan["schedule"][0]["topic"] == "Bronquiolitis"
    assert plan["schedule"][0]["practice_case_id"] == "caso-bronquiolitis-01"
    assert plan["schedule"][0]["gpc_readings"][0]["gpc_id"].startswith("EJEMPLO-GPC")
    assert plan["schedule"][-1]["is_mock_exam"]


def test_tutor_tools_write_attempts(repo, ana, ana_state, snapshot):
    ctx = Ctx(ana_state)
    item = repo.get_item("caso-bronquiolitis-01")
    assert obtener_caso(item.id, ctx)["caso"]["id"] == item.id
    gpc = buscar_gpc(item.id, ctx)
    assert gpc["gpc_id"] == item.citation.gpc_id and gpc["fragmento"] == item.citation.snippet
    wrong_letter = next(o.id for o in item.options if o.id != item.correct_option_id)
    ids = []
    try:
        wrong = registrar_intento(item.id, wrong_letter, ctx)
        ids.append(wrong["intento_id"])
        assert wrong["es_correcta"] is False
        assert "explicacion" not in wrong and "cita" not in wrong
        assert item.id in st.protected_item_ids(ctx.state)

        right = registrar_intento(item.id, item.correct_option_id, ctx)
        ids.append(right["intento_id"])
        assert right["es_correcta"] is True
        assert right["explicacion"] == item.explanation
        assert right["cita"]["gpc_id"] == item.citation.gpc_id
        assert item.id not in st.protected_item_ids(ctx.state)

        rows = (
            repo._client.table("attempts").select("user_id, used_tutor, item_id").in_("id", ids).execute().data
        )
        assert len(rows) == 2 and all(r["user_id"] == ana.id and r["used_tutor"] for r in rows)
    finally:
        repo.delete_attempts(ana.id, ids)
