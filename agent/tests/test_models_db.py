"""Pydantic parsing of the real ``items.payload`` rows (integration)."""

import pytest
from pydantic import ValidationError

from razona_agent.models import Item

pytestmark = pytest.mark.integration


def test_all_db_items_parse(repo):
    rows = repo._client.table("items").select("id, kind, specialty_id, topic, payload").execute().data
    assert len(rows) >= 10
    for row in rows:
        item = Item.model_validate(row["payload"])
        assert item.id == row["id"]
        assert item.kind == row["kind"]
        assert item.specialty_id == row["specialty_id"]
        assert item.topic == row["topic"]
        assert item.citation.gpc_id and item.citation.snippet
        assert item.is_sample is True


def test_public_item_hides_answer(repo):
    item = repo.get_item("caso-bronquiolitis-01")
    public = item.to_public("Pediatría").model_dump()
    for hidden in ("correct_option_id", "explanation", "citation"):
        assert hidden not in public
    assert public["aviso"].startswith("CONTENIDO DE EJEMPLO")


def test_invalid_payload_is_rejected(repo):
    payload = repo.get_item("caso-bronquiolitis-01").model_dump(by_alias=True)
    payload["correctOptionId"] = "e"
    with pytest.raises(ValidationError):
        Item.model_validate(payload)
