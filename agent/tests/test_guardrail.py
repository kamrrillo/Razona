from razona_agent.callbacks import normalize, reveals_answer
from razona_agent.models import Item

ITEM = Item.model_validate(
    {
        "id": "caso-x",
        "kind": "case",
        "specialtyId": "pediatria",
        "topic": "Bronquiolitis",
        "title": "t",
        "vignette": "v",
        "question": "q",
        "options": [
            {"id": "a", "text": "Salbutamol nebulizado de forma rutinaria"},
            {"id": "b", "text": "Medidas de soporte y vigilancia de datos de alarma"},
            {"id": "c", "text": "Prednisolona oral por 5 días"},
        ],
        "correctOptionId": "b",
        "explanation": "e",
        "citation": {"gpcId": "G", "gpcTitle": "GPC", "section": "S", "snippet": "x"},
        "isSample": True,
    }
)


def test_normalize_strips_accents():
    assert normalize("  Opción   CORRECTA ") == "opcion correcta"


def test_detects_explicit_reveal_phrases():
    assert reveals_answer("La respuesta correcta es la b.", ITEM)
    assert reveals_answer("La opción correcta sería la de soporte", ITEM)
    assert reveals_answer("Creo que la opción b es la correcta", ITEM)


def test_detects_correct_option_text():
    assert reveals_answer("Lo indicado: medidas de soporte y vigilancia de datos de alarma.", ITEM)


def test_allows_socratic_question_and_presenting_the_item():
    assert not reveals_answer("¿Qué dato de la viñeta te hace pensar en un broncodilatador?", ITEM)
    presenting = "\n".join(f"{o.id}) {o.text}" for o in ITEM.options)
    assert not reveals_answer(f"Pregunta: q\n{presenting}", ITEM)
    assert not reveals_answer("No puedo decirte cuál es la respuesta correcta.", ITEM)
