"""Domain services used by the tools.

Each function receives the repository, the student's ``user_id`` (taken from
session state by the tool wrapper) and, when needed, the mutable session state.
They return JSON-safe dicts. Clinical text (explanations, citations) comes only
from ``items.payload`` in the database.
"""

from __future__ import annotations

from collections.abc import MutableMapping
from datetime import datetime, timezone
from typing import Any

from . import state as st
from .db import RazonaRepository
from .learning import (
    TopicInfo,
    build_study_plan,
    choose_topic_thompson,
    compute_streak,
    local_day,
    parse_ts,
    specialty_stats,
    thompson_seed,
    topic_stats,
    weakest_topic,
)
from .models import (
    SAMPLE_NOTICE,
    DiagnosticResult,
    ExamSummary,
    GpcReading,
    Item,
    ItemReview,
    Outcome,
    Progress,
    SpecialtyStat,
    TopicStat,
    WeakTopic,
)

DIAGNOSTIC_EXAM_KEY = "diagnostico-adk"
SECONDS_PER_ITEM = 90
MAX_PER_SPECIALTY = 5

State = MutableMapping[str, Any]


def _error(message: str) -> dict[str, Any]:
    return {"error": message}


def normalize_option(value: str) -> str:
    """Accepts 'b', 'B', 'b)', 'opción b', ... and returns the letter (or '')."""
    v = (value or "").strip().lower()
    for prefix in ("opción", "opcion", "inciso"):
        if v.startswith(prefix):
            v = v[len(prefix) :].strip()
    return v[:1] if v[:1] in {"a", "b", "c", "d", "e"} else ""


def _public(repo: RazonaRepository, item: Item) -> dict[str, Any]:
    return item.to_public(repo.specialty_name(item.specialty_id)).model_dump(mode="json")


def _case_topics(repo: RazonaRepository) -> list[str]:
    return list(dict.fromkeys(i.topic for i in repo.list_items("case")))


def _weak_topic(repo: RazonaRepository, stats: list[TopicStat]) -> WeakTopic | None:
    weak = weakest_topic(stats)
    if not weak:
        return None
    return WeakTopic(
        topic=weak.topic,
        specialty_id=weak.specialty_id,
        specialty_name=repo.specialty_name(weak.specialty_id),
        correct=weak.correct,
        total=weak.total,
        mastery=round(weak.mastery, 4),
        has_case=weak.topic in _case_topics(repo),
    )


def _named_specialty_stats(
    repo: RazonaRepository, outcomes: list[Outcome], include_empty: bool
) -> list[SpecialtyStat]:
    by_id = {s.specialty_id: s for s in specialty_stats(outcomes)}
    result = []
    for spec in repo.list_specialties():
        s = by_id.get(spec.id)
        if s is None and not include_empty:
            continue
        result.append(
            SpecialtyStat(
                specialty_id=spec.id,
                name=spec.name,
                correct=s.correct if s else 0,
                total=s.total if s else 0,
                accuracy=round(s.accuracy, 4) if s else 0.0,
            )
        )
    return result


# =========================================================================== diagnóstico


def list_specialties(repo: RazonaRepository) -> dict[str, Any]:
    items = repo.list_items()
    return {
        "especialidades": [
            {
                "id": s.id,
                "nombre": s.name,
                "reactivos_disponibles": sum(1 for i in items if i.specialty_id == s.id),
                "temas": sorted({i.topic for i in items if i.specialty_id == s.id}),
            }
            for s in repo.list_specialties()
        ],
        "aviso": SAMPLE_NOTICE,
    }


def select_diagnostic_items(items: list[Item], specialty_ids: list[str], n: int) -> list[Item]:
    """Up to ``n`` items per specialty: exam items first, distinct topics first, then by id."""
    selected: list[Item] = []
    for spec in specialty_ids:
        pool = sorted(
            (i for i in items if i.specialty_id == spec),
            key=lambda i: (i.kind != "exam", i.id),
        )
        picked: list[Item] = []
        seen_topics: set[str] = set()
        for item in pool:  # first pass: one per topic
            if len(picked) < n and item.topic not in seen_topics:
                picked.append(item)
                seen_topics.add(item.topic)
        for item in pool:  # second pass: fill
            if len(picked) < n and item not in picked:
                picked.append(item)
        selected.extend(picked)
    return selected


def create_diagnostic(
    repo: RazonaRepository, user_id: str, state: State, n_per_specialty: int = 2
) -> dict[str, Any]:
    n = max(1, min(int(n_per_specialty or 2), MAX_PER_SPECIALTY))
    specialty_ids = [s.id for s in repo.list_specialties()]
    items = select_diagnostic_items(repo.list_items(), specialty_ids, n)
    if not items:
        return _error("No hay reactivos en la base de datos. Corre `pnpm seed:demo`.")

    exam_id = repo.create_exam(user_id, DIAGNOSTIC_EXAM_KEY, SECONDS_PER_ITEM * len(items))
    state[st.DIAGNOSTIC] = {
        "exam_id": exam_id,
        "item_ids": [i.id for i in items],
        "finalizado": False,
    }
    state[st.ACTIVE_EXAM] = exam_id
    return {
        "exam_id": exam_id,
        "total": len(items),
        "duracion_minutos": round(SECONDS_PER_ITEM * len(items) / 60),
        "reactivos": [_public(repo, i) for i in items],
        "instrucciones": (
            "Presenta un reactivo a la vez, en orden. Sin pistas ni tutor durante el "
            "diagnóstico. No digas si una respuesta es correcta hasta calificar."
        ),
        "aviso": SAMPLE_NOTICE,
    }


def register_answer(
    repo: RazonaRepository, user_id: str, state: State, item_id: str, option: str
) -> dict[str, Any]:
    diag = st.active_diagnostic(state)
    if not diag:
        return _error("No hay un diagnóstico activo. Crea uno con crear_examen_diagnostico.")
    exam = repo.get_exam(user_id, diag["exam_id"])
    if exam is None:
        return _error("No encontré el examen diagnóstico de esta estudiante.")
    if exam.finished_at:
        return _error("El diagnóstico ya fue calificado; no se pueden cambiar respuestas.")
    if item_id not in diag["item_ids"]:
        return _error(f"El reactivo {item_id} no forma parte de este diagnóstico.")
    item = repo.get_item(item_id)
    letter = normalize_option(option)
    if item is None or item.option(letter) is None:
        valid = ", ".join(o.id for o in item.options) if item else "a-e"
        return _error(f"Opción no válida. Opciones posibles: {valid}.")

    repo.upsert_exam_answer(user_id, exam.id, item, letter, letter == item.correct_option_id)
    answered = {a.item_id for a in repo.exam_answers(user_id, exam.id)}
    next_id = next((i for i in diag["item_ids"] if i not in answered), None)
    next_item = repo.get_item(next_id) if next_id else None
    return {
        "registrada": True,
        "item_id": item_id,
        "opcion": letter,
        "respondidas": len(answered & set(diag["item_ids"])),
        "total": len(diag["item_ids"]),
        "siguiente_reactivo": _public(repo, next_item) if next_item else None,
        "nota": "No reveles si fue correcta. Al terminar, llama a calificar_diagnostico.",
    }


def grade_diagnostic(repo: RazonaRepository, user_id: str, state: State) -> dict[str, Any]:
    diag = state.get(st.DIAGNOSTIC)
    if not isinstance(diag, dict) or not diag.get("exam_id"):
        return _error("No hay un diagnóstico que calificar. Crea uno con crear_examen_diagnostico.")
    exam = repo.get_exam(user_id, diag["exam_id"])
    if exam is None:
        return _error("No encontré el examen diagnóstico de esta estudiante.")

    item_ids: list[str] = diag["item_ids"]
    answers = {a.item_id: a for a in repo.exam_answers(user_id, exam.id) if a.item_id in item_ids}
    total = len(item_ids)
    correct = sum(1 for a in answers.values() if a.is_correct)
    score = round(correct / total * 100, 2) if total else 0.0

    if not exam.finished_at:
        repo.finish_exam(user_id, exam.id, total, correct, score)
    else:  # idempotent: report what was stored
        total = exam.total if exam.total is not None else total
        correct = exam.correct if exam.correct is not None else correct
        score = exam.score if exam.score is not None else score

    exam_outcomes = [
        Outcome(topic=a.topic, specialty_id=a.specialty_id, is_correct=a.is_correct, at="")
        for a in answers.values()
    ]
    by_topic = sorted(topic_stats(exam_outcomes), key=lambda s: (s.mastery, s.topic))
    weak_topics = [s for s in by_topic if s.correct < s.total]

    review = []
    for item_id in item_ids:
        item = repo.get_item(item_id)
        if item is None:
            continue
        ans = answers.get(item_id)
        review.append(
            ItemReview(
                item_id=item.id,
                topic=item.topic,
                specialty_id=item.specialty_id,
                question=item.question,
                selected_option=ans.selected_option if ans else None,
                correct_option=item.correct_option_id,
                correct_option_text=item.correct_option.text,
                is_correct=bool(ans and ans.is_correct),
                explanation=item.explanation,
                citation=item.citation,
            )
        )

    overall = topic_stats(repo.load_outcomes(user_id))
    result = DiagnosticResult(
        exam_id=exam.id,
        total=total,
        answered=len(answers),
        correct=correct,
        score=float(score),
        by_specialty=_named_specialty_stats(repo, exam_outcomes, include_empty=False),
        by_topic=by_topic,
        weak_topics=weak_topics,
        overall_weak_topic=_weak_topic(repo, overall),
        review=review,
    )
    state[st.DIAGNOSTIC] = {**diag, "finalizado": True}
    state[st.ACTIVE_EXAM] = None
    return result.model_dump(mode="json", by_alias=False)


# =========================================================================== preparación


def get_progress(
    repo: RazonaRepository, user_id: str, now: datetime | None = None
) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    outcomes = repo.load_outcomes(user_id)
    today = local_day(now)
    stats = topic_stats(outcomes)
    profile = repo.get_profile(user_id) or {}
    progress = Progress(
        nombre=profile.get("display_name", ""),
        totals_answered=len(outcomes),
        totals_correct=sum(1 for o in outcomes if o.is_correct),
        answered_today=sum(1 for o in outcomes if local_day(parse_ts(o.at)) == today),
        streak=compute_streak([parse_ts(o.at) for o in outcomes], now),
        by_specialty=_named_specialty_stats(repo, outcomes, include_empty=True),
        by_topic=sorted(stats, key=lambda s: (s.mastery, s.topic)),
        weak_topic=_weak_topic(repo, stats),
        recent_exams=[
            ExamSummary(
                id=e.id,
                exam_key=e.exam_key,
                finished_at=e.finished_at or "",
                score=float(e.score or 0),
                correct=e.correct or 0,
                total=e.total or 0,
            )
            for e in repo.recent_exams(user_id)
        ],
    )
    return progress.model_dump(mode="json")


def get_weak_topic(repo: RazonaRepository, user_id: str) -> dict[str, Any]:
    weak = _weak_topic(repo, topic_stats(repo.load_outcomes(user_id)))
    if weak is None:
        return {
            "tema_debil": None,
            "mensaje": "Aún no hay un tema con al menos 3 respuestas. Haz el diagnóstico primero.",
        }
    return {"tema_debil": weak.model_dump(mode="json")}


def recommend_next_case(
    repo: RazonaRepository, user_id: str, state: State, topic: str = ""
) -> dict[str, Any]:
    """Mirrors chooseCase in lib/data/practice.ts ('debil' | explicit topic | Thompson)."""
    cases = repo.list_items("case")
    if not cases:
        return _error("No hay casos de práctica en la base de datos.")
    outcomes = repo.load_outcomes(user_id)
    stats = topic_stats(outcomes)
    case_topics = list(dict.fromkeys(c.topic for c in cases))

    wanted = (topic or "").strip()
    chosen: str | None = None
    reason = "thompson"
    if wanted.lower() in {"debil", "débil", "tema debil", "tema débil", "weak"}:
        weak = weakest_topic([s for s in stats if s.topic in case_topics])
        chosen, reason = (weak.topic if weak else None), "debil"
    elif wanted:
        chosen = next((t for t in case_topics if t.lower() == wanted.lower()), None)
        reason = "tema"
    if chosen is None:
        chosen = choose_topic_thompson(case_topics, stats, thompson_seed(user_id, len(outcomes)))
        reason = "thompson"

    item = next(c for c in cases if c.topic == chosen)
    state[st.ACTIVE_CASE] = item.id
    stat = next((s for s in stats if s.topic == chosen), None)
    return {
        "motivo": reason,
        "explicacion_motivo": {
            "debil": "Es tu tema más débil (menor dominio con al menos 3 respuestas).",
            "tema": "Es el tema que pediste.",
            "thompson": "Elegido por Thompson sampling sobre tu probabilidad de error por tema.",
        }[reason],
        "dominio_actual": round(stat.mastery, 4) if stat else None,
        "caso": _public(repo, item),
    }


def build_topic_catalog(repo: RazonaRepository) -> list[TopicInfo]:
    """One entry per topic, ordered by specialty then content order (cases first)."""
    items = repo.list_items()
    catalog: list[TopicInfo] = []
    for spec in repo.list_specialties():
        spec_items = sorted(
            (i for i in items if i.specialty_id == spec.id), key=lambda i: (i.kind != "case", i.id)
        )
        for topic in dict.fromkeys(i.topic for i in spec_items):
            topic_items = [i for i in spec_items if i.topic == topic]
            case = next((i for i in topic_items if i.kind == "case"), None)
            readings: dict[tuple[str, str], GpcReading] = {}
            for i in topic_items:
                key = (i.citation.gpc_id, i.citation.section)
                readings.setdefault(
                    key,
                    GpcReading(
                        gpc_id=i.citation.gpc_id,
                        gpc_title=i.citation.gpc_title,
                        section=i.citation.section,
                    ),
                )
            catalog.append(
                TopicInfo(
                    topic=topic,
                    specialty_id=spec.id,
                    specialty_name=spec.name,
                    case_item_id=case.id if case else None,
                    case_title=case.title if case else None,
                    item_count=len(topic_items),
                    gpc_readings=list(readings.values()),
                )
            )
    return catalog


def generate_study_plan(
    repo: RazonaRepository, user_id: str, days: int = 7, now: datetime | None = None
) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    stats = topic_stats(repo.load_outcomes(user_id))
    start = datetime.fromisoformat(local_day(now)).date()
    plan = build_study_plan(stats, build_topic_catalog(repo), days, start)
    return plan.model_dump(mode="json")


# =========================================================================== tutor


def get_case(repo: RazonaRepository, state: State, item_id: str) -> dict[str, Any]:
    item = repo.get_item(item_id)
    if item is None:
        return _error(f"No existe el caso {item_id}.")
    state[st.ACTIVE_CASE] = item.id
    return {"caso": _public(repo, item)}


def search_gpc(repo: RazonaRepository, item_id: str) -> dict[str, Any]:
    item = repo.get_item(item_id)
    if item is None:
        return _error(f"No existe el caso {item_id}.")
    c = item.citation
    return {
        "gpc_id": c.gpc_id,
        "gpc_titulo": c.gpc_title,
        "seccion": c.section,
        "fragmento": c.snippet,
        "aviso": SAMPLE_NOTICE,
    }


def register_attempt(
    repo: RazonaRepository, user_id: str, state: State, item_id: str, option: str
) -> dict[str, Any]:
    if st.active_diagnostic(state):
        return _error("Hay un diagnóstico en curso: termina y califica el diagnóstico primero.")
    item = repo.get_item(item_id)
    if item is None:
        return _error(f"No existe el caso {item_id}.")
    letter = normalize_option(option)
    if item.option(letter) is None:
        return _error(f"Opción no válida. Opciones posibles: {', '.join(o.id for o in item.options)}.")

    is_correct = letter == item.correct_option_id
    attempt_id = repo.insert_attempt(user_id, item, letter, is_correct, used_tutor=True)
    state[st.ACTIVE_CASE] = item.id
    if is_correct:
        solved = list(state.get(st.SOLVED_CASES) or [])
        if item.id not in solved:
            state[st.SOLVED_CASES] = [*solved, item.id]
        return {
            "intento_id": attempt_id,
            "es_correcta": True,
            "explicacion": item.explanation,
            "cita": item.citation.model_dump(mode="json"),
            "aviso": SAMPLE_NOTICE,
        }
    return {
        "intento_id": attempt_id,
        "es_correcta": False,
        "opcion_elegida": letter,
        "nota": (
            "Incorrecta. NO reveles la opción correcta: haz UNA pregunta socrática y cita "
            "la GPC (usa buscar_gpc)."
        ),
    }
