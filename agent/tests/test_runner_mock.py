"""End-to-end through ADK's Runner with a scripted fake model (no Gemini, no API key)."""

from __future__ import annotations

import asyncio
from typing import AsyncGenerator

import pytest
from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.genai import types

from razona_agent import state as st
from razona_agent.agent import build_root_agent
from razona_agent.runtime import build_runner, send_message

pytestmark = pytest.mark.integration


def _call(name: str, **args) -> LlmResponse:
    return LlmResponse(
        content=types.Content(
            role="model", parts=[types.Part(function_call=types.FunctionCall(name=name, args=args))]
        )
    )


def _text(text: str) -> LlmResponse:
    return LlmResponse(content=types.Content(role="model", parts=[types.Part(text=text)]))


class ScriptedLlm(BaseLlm):
    """Returns the scripted responses in order and records every request."""

    script: list[LlmResponse] = []
    requests: list[LlmRequest] = []

    async def generate_content_async(
        self, llm_request: LlmRequest, stream: bool = False
    ) -> AsyncGenerator[LlmResponse, None]:
        self.requests.append(llm_request)
        yield self.script.pop(0)


def _system_instruction(req: LlmRequest) -> str:
    si = req.config.system_instruction if req.config else None
    if isinstance(si, str):
        return si
    if isinstance(si, types.Content):
        return "".join(p.text or "" for p in si.parts or [])
    return str(si or "")


def test_coordinator_transfers_to_tutor_and_guardrail_blocks_answer(repo, ana):
    item = repo.get_item("caso-bronquiolitis-01")
    llm = ScriptedLlm(
        model="fake-llm",
        script=[
            _call("transfer_to_agent", agent_name="tutor_socratico"),
            _call("obtener_caso", item_id=item.id),
            _call("buscar_gpc", item_id=item.id),
            _text(f"La respuesta correcta es b) {item.correct_option.text}."),
        ],
        requests=[],
    )
    runner = build_runner(build_root_agent(model=llm))

    async def run():
        # Simulates `adk web`/`adk api_server`: session WITHOUT our state, ADK user id = email.
        session = await runner.session_service.create_session(
            app_name=runner.app_name, user_id=ana.email
        )
        replies = await send_message(runner, ana.email, session.id, "Quiero practicar un caso")
        session = await runner.session_service.get_session(
            app_name=runner.app_name, user_id=ana.email, session_id=session.id
        )
        return replies, session

    replies, session = asyncio.run(run())

    assert llm.script == [], "el guion no se consumió completo"
    # the root resolved the student into state, and the instruction got her name
    assert session.state[st.USER_ID] == ana.id
    assert "La estudiante se llama: Ana" in _system_instruction(llm.requests[0])
    assert "tutor socrático" in _system_instruction(llm.requests[1])
    # tools ran with the user id from state
    assert session.state[st.ACTIVE_CASE] == item.id
    # the guardrail replaced the reply that revealed the answer
    final = replies[-1]
    assert final["autor"] == "tutor_socratico"
    assert "respuesta correcta es" not in final["texto"].lower()
    assert item.correct_option.text not in final["texto"]
    assert item.citation.gpc_title in final["texto"]


def test_missing_key_answers_in_spanish_without_calling_gemini(ana):
    """With a Gemini model name and no key, the before_model callback answers instead."""
    runner = build_runner(build_root_agent(model="gemini-3.5-flash"))

    async def run():
        session = await runner.session_service.create_session(
            app_name=runner.app_name, user_id=ana.id, state={st.USER_ID: ana.id}
        )
        return await send_message(runner, ana.id, session.id, "Hola")

    replies = asyncio.run(run())
    assert replies and "GOOGLE_API_KEY" in replies[-1]["texto"]
