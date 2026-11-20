"""The agent tree builds without an API key."""

from razona_agent import root_agent
from razona_agent.callbacks import answer_guardrail, require_credentials


def _tool_names(agent):
    return sorted(getattr(t, "__name__", getattr(t, "name", "")) for t in agent.tools)


def test_root_agent_tree():
    assert root_agent.name == "coordinador"
    subs = {a.name: a for a in root_agent.sub_agents}
    assert set(subs) == {"agente_diagnostico", "agente_preparacion", "tutor_socratico"}
    assert _tool_names(subs["agente_diagnostico"]) == [
        "calificar_diagnostico", "crear_examen_diagnostico", "listar_especialidades",
        "registrar_respuesta",
    ]
    assert _tool_names(subs["agente_preparacion"]) == [
        "generar_plan_estudio", "obtener_progreso", "obtener_tema_debil",
        "recomendar_siguiente_caso",
    ]
    assert _tool_names(subs["tutor_socratico"]) == [
        "buscar_gpc", "obtener_caso", "recomendar_siguiente_caso", "registrar_intento",
    ]


def test_callbacks_and_model():
    for agent in [root_agent, *root_agent.sub_agents]:
        assert agent.after_model_callback is answer_guardrail
        assert require_credentials in agent.before_model_callback
        assert agent.model.startswith("gemini-")
    assert root_agent.before_agent_callback is not None


def test_tool_declarations_hide_tool_context():
    from google.adk.tools.function_tool import FunctionTool

    for agent in root_agent.sub_agents:
        for fn in agent.tools:
            decl = FunctionTool(fn)._get_declaration()
            schema = decl.parameters_json_schema or {}
            props = schema.get("properties", {}) if isinstance(schema, dict) else {}
            assert "tool_context" not in props
            assert "user_id" not in props  # the user id never comes from the LLM


def test_instructions_are_spanish():
    assert "Eres el coordinador de Razona" in root_agent.instruction
    assert all("GPC" in a.instruction for a in root_agent.sub_agents)
