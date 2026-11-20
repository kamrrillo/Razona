"""Pure learning logic, ported 1:1 from ``lib/learning/*.ts``.

- Topic mastery = Beta posterior mean (correct + 1) / (total + 2).
- Weak topic = lowest mastery among topics with >= 3 answers.
- Next topic = Thompson sampling on error probability Beta(1 + errors, 1 + correct),
  with the same deterministic PRNG (mulberry32) and seed hashing as the TS app,
  so the same history picks the same topic in both stacks.
- Streak in America/Mexico_City.
- Study plan: deterministic schedule derived from the stats (the LLM only narrates it).
"""

from __future__ import annotations

import math
from collections.abc import Callable, Iterable
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from pydantic import BaseModel

from .models import (
    GpcReading,
    Outcome,
    SpecialtyStat,
    Streak,
    StreakDay,
    StudyDay,
    StudyPlan,
    TopicStat,
)

DEMO_TIME_ZONE = "America/Mexico_City"
MASTERY_THRESHOLD = 0.7
MIN_ATTEMPTS_FOR_MASTERY = 3
MAX_PLAN_DAYS = 30

_U32 = 0xFFFFFFFF


# --------------------------------------------------------------------------- PRNG (random.ts)


def _imul(a: int, b: int) -> int:
    return (a * b) & _U32


def mulberry32(seed: int) -> Callable[[], float]:
    """Deterministic PRNG identical to ``mulberry32`` in random.ts."""
    state = seed & _U32

    def rng() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & _U32
        t = state
        t = _imul(t ^ (t >> 15), t | 1)
        t = (t ^ ((t + _imul(t ^ (t >> 7), t | 61)) & _U32)) & _U32
        return ((t ^ (t >> 14)) & _U32) / 4294967296

    return rng


def hash_string(value: str) -> int:
    """FNV-1a over UTF-16 code units, identical to ``hashString`` in random.ts."""
    h = 2166136261
    data = value.encode("utf-16-le")
    for i in range(0, len(data), 2):
        h ^= data[i] | (data[i + 1] << 8)
        h = _imul(h, 16777619)
    return h & _U32


def _normal(rng: Callable[[], float]) -> float:
    u = 1 - rng()
    v = rng()
    return math.sqrt(-2 * math.log(u)) * math.cos(2 * math.pi * v)


def sample_gamma(shape: float, rng: Callable[[], float]) -> float:
    """Gamma(shape, 1) via Marsaglia–Tsang (same draw order as random.ts)."""
    if shape < 1:
        g = sample_gamma(shape + 1, rng)
        return g * rng() ** (1 / shape)
    d = shape - 1 / 3
    c = 1 / math.sqrt(9 * d)
    while True:
        while True:
            x = _normal(rng)
            v = 1 + c * x
            if v > 0:
                break
        v = v * v * v
        u = rng()
        if u < 1 - 0.0331 * x**4:
            return d * v
        if math.log(u) < 0.5 * x * x + d * (1 - v + math.log(v)):
            return d * v


def sample_beta(alpha: float, beta: float, rng: Callable[[], float]) -> float:
    x = sample_gamma(alpha, rng)
    y = sample_gamma(beta, rng)
    return x / (x + y)


# --------------------------------------------------------------------------- stats (stats.ts)


def topic_stats(outcomes: Iterable[Outcome]) -> list[TopicStat]:
    acc: dict[str, list] = {}
    for o in outcomes:
        s = acc.setdefault(o.topic, [o.specialty_id, 0, 0])
        s[2] += 1
        if o.is_correct:
            s[1] += 1
    return [
        TopicStat(
            topic=topic,
            specialty_id=spec,
            correct=correct,
            total=total,
            mastery=(correct + 1) / (total + 2),
        )
        for topic, (spec, correct, total) in acc.items()
    ]


def specialty_stats(outcomes: Iterable[Outcome]) -> list[SpecialtyStat]:
    acc: dict[str, list[int]] = {}
    for o in outcomes:
        s = acc.setdefault(o.specialty_id, [0, 0])
        s[1] += 1
        if o.is_correct:
            s[0] += 1
    return [
        SpecialtyStat(
            specialty_id=spec,
            correct=correct,
            total=total,
            accuracy=0.0 if total == 0 else correct / total,
        )
        for spec, (correct, total) in acc.items()
    ]


def weakest_topic(stats: Iterable[TopicStat], min_attempts: int = 3) -> TopicStat | None:
    """Lowest posterior mastery among topics with at least ``min_attempts`` answers."""
    eligible = [s for s in stats if s.total >= min_attempts]
    if not eligible:
        return None
    worst = eligible[0]
    for s in eligible[1:]:
        if s.mastery < worst.mastery:
            worst = s
    return worst


# --------------------------------------------------------------------------- thompson.ts


def choose_topic_thompson(candidate_topics: list[str], stats: list[TopicStat], seed: int) -> str:
    """Samples P(error) ~ Beta(1 + errors, 1 + correct) per topic and picks the highest."""
    if not candidate_topics:
        raise ValueError("No hay temas candidatos")
    rng = mulberry32(seed)
    by_topic = {s.topic: s for s in stats}
    best = candidate_topics[0]
    best_sample = -1.0
    for topic in candidate_topics:
        s = by_topic.get(topic)
        errors = s.total - s.correct if s else 0
        correct = s.correct if s else 0
        sample = sample_beta(1 + errors, 1 + correct, rng)
        if sample > best_sample:
            best_sample = sample
            best = topic
    return best


def thompson_seed(user_id: str, answered: int) -> int:
    """Same seed as lib/data/practice.ts: hashString(`${userId}:${outcomes.length}`)."""
    return hash_string(f"{user_id}:{answered}")


# --------------------------------------------------------------------------- streak.ts


def local_day(moment: datetime, time_zone: str = DEMO_TIME_ZONE) -> str:
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(ZoneInfo(time_zone)).date().isoformat()


def _previous_day(day: str) -> str:
    return (date.fromisoformat(day) - timedelta(days=1)).isoformat()


def parse_ts(value: str) -> datetime:
    """Parses Postgres/ISO timestamps (``Z`` or offsets, variable fraction digits)."""
    v = value.strip().replace(" ", "T", 1)
    if v.endswith("Z"):
        v = v[:-1] + "+00:00"
    # Postgres may return 1-6 fraction digits; normalize to exactly 6.
    if "." in v:
        head, rest = v.split(".", 1)
        digits = "".join(ch for ch in rest if ch.isdigit())
        tz = rest[len(digits) :]
        v = f"{head}.{(digits + '000000')[:6]}{tz}"
    dt = datetime.fromisoformat(v)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def compute_streak(
    activity: Iterable[datetime], now: datetime, time_zone: str = DEMO_TIME_ZONE
) -> Streak:
    """Consecutive active days; if today has no activity yet, the streak counts from yesterday."""
    days = {local_day(d, time_zone) for d in activity}
    today = local_day(now, time_zone)
    active_today = today in days

    cursor = today if active_today else _previous_day(today)
    current = 0
    while cursor in days:
        current += 1
        cursor = _previous_day(cursor)

    last_seven: list[StreakDay] = []
    d = today
    for _ in range(7):
        last_seven.insert(0, StreakDay(day=d, active=d in days))
        d = _previous_day(d)
    return Streak(current=current, active_today=active_today, last_seven_days=last_seven)


# --------------------------------------------------------------------------- study plan


class TopicInfo(BaseModel):
    """Catalog entry built from the DB items of one topic."""

    topic: str
    specialty_id: str
    specialty_name: str
    case_item_id: str | None = None
    case_title: str | None = None
    item_count: int = 0
    gpc_readings: list[GpcReading] = []


def _is_mastered(s: TopicStat | None) -> bool:
    return bool(s and s.total >= MIN_ATTEMPTS_FOR_MASTERY and s.mastery >= MASTERY_THRESHOLD)


def prioritize_topics(stats: list[TopicStat], catalog: list[TopicInfo]) -> list[TopicInfo]:
    """Weak topic first, then practiced-but-not-mastered (by mastery), then new, then mastered."""
    by_topic = {s.topic: s for s in stats}
    weak = weakest_topic(stats)
    order = {info.topic: i for i, info in enumerate(catalog)}

    def key(info: TopicInfo) -> tuple:
        s = by_topic.get(info.topic)
        if weak and info.topic == weak.topic:
            return (0, 0.0, 0, order[info.topic])
        if s and s.total > 0 and not _is_mastered(s):
            return (1, s.mastery, -s.total, order[info.topic])
        if not s or s.total == 0:
            return (2, 0.0, 0, order[info.topic])
        return (3, s.mastery, 0, order[info.topic])

    return sorted(catalog, key=key)


def build_study_plan(
    stats: list[TopicStat],
    catalog: list[TopicInfo],
    days: int,
    start: date,
) -> StudyPlan:
    """Deterministic plan: one focus topic per day cycling by priority; last day = mock exam.

    With ``days >= 3`` the final day is a diagnostic re-take to measure progress.
    """
    days = max(1, min(int(days), MAX_PLAN_DAYS))
    by_topic = {s.topic: s for s in stats}
    weak = weakest_topic(stats)
    priority = prioritize_topics(stats, catalog)
    study_days = days - 1 if days >= 3 else days

    schedule: list[StudyDay] = []
    for i in range(study_days):
        info = priority[i % len(priority)] if priority else None
        if info is None:
            break
        s = by_topic.get(info.topic)
        if weak and info.topic == weak.topic:
            reason = f"Tema débil: dominio {round(weak.mastery * 100)} % ({weak.correct}/{weak.total})."
            minutes = 45
        elif s and s.total > 0 and not _is_mastered(s):
            reason = f"En progreso: dominio {round(s.mastery * 100)} % ({s.correct}/{s.total})."
            minutes = 40
        elif not s or s.total == 0:
            reason = "Tema nuevo: aún no tienes respuestas."
            minutes = 30
        else:
            reason = f"Repaso de tema dominado: dominio {round(s.mastery * 100)} %."
            minutes = 20
        if info.case_item_id:
            goal = (
                f"Resolver el caso «{info.case_title}» con el tutor socrático y repasar "
                f"{info.item_count} reactivo(s) del tema; leer la sección de la GPC indicada."
            )
        else:
            goal = (
                f"Repasar {info.item_count} reactivo(s) del tema en el simulacro y leer "
                "la sección de la GPC indicada."
            )
        schedule.append(
            StudyDay(
                day_number=i + 1,
                date=(start + timedelta(days=i)).isoformat(),
                topic=info.topic,
                specialty_id=info.specialty_id,
                specialty_name=info.specialty_name,
                reason=reason,
                mastery=round(s.mastery, 4) if s else None,
                practice_case_id=info.case_item_id,
                practice_case_title=info.case_title,
                review_item_count=info.item_count,
                gpc_readings=info.gpc_readings,
                minutes=minutes,
                goal=goal,
            )
        )

    if days >= 3:
        schedule.append(
            StudyDay(
                day_number=days,
                date=(start + timedelta(days=days - 1)).isoformat(),
                topic="Simulacro diagnóstico",
                specialty_id="todas",
                specialty_name="Todas",
                reason="Medir tu avance contra el diagnóstico inicial.",
                mastery=None,
                practice_case_id=None,
                practice_case_title=None,
                review_item_count=0,
                gpc_readings=[],
                minutes=30,
                goal="Repetir el examen diagnóstico con el agente de diagnóstico y comparar resultados.",
                is_mock_exam=True,
            )
        )

    return StudyPlan(
        days=days,
        start_date=start.isoformat(),
        weak_topic=weak.topic if weak else None,
        priority_topics=[p.topic for p in priority],
        schedule=schedule,
    )
