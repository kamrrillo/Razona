"""Pydantic parsing of the case bank as served by ``v_casos_app`` (integration)."""

import pytest
from pydantic import ValidationError

from razona_agent.models import Item

pytestmark = pytest.mark.integration


def test_all_db_items_parse(repo):
    rows = (
        repo._client.table("v_casos_app").select("id, specialty_id, topic, tipo, payload").execute().data
    )
    assert len(rows) >= 10
    for row in rows:
        item = Item.model_validate(row["payload"])
        assert item.id == row["id"]
        assert item.specialty_id == row["specialty_id"]
        assert item.topic == row["topic"]
        assert item.tipo == row["tipo"]
        assert item.citation.gpc_id and item.citation.snippet and item.citation.page
        assert item.is_sample is False
        assert len(item.key_points) >= 2 and len(item.rubric) >= 4
        # La rúbrica nunca entrega la opción correcta como "error".
        assert item.rubric_for(item.correct_option_id) is None


def test_public_item_hides_answer(repo):
    item = repo.get_item("RZ-PED-032-I")
    public = item.to_public("Pediatría").model_dump()
    for hidden in ("correct_option_id", "explanation", "citation", "rubric", "key_points"):
        assert hidden not in public
    assert "criterio clínico" in public["aviso"]


def test_invalid_payload_is_rejected(repo):
    payload = repo.get_item("RZ-PED-032-I").model_dump(by_alias=True)
    payload["correctOptionId"] = "z"
    with pytest.raises(ValidationError):
        Item.model_validate(payload)
