"""Unit tests for learning.py (parity with lib/learning/*.ts)."""

from datetime import date, datetime, timedelta, timezone

from razona_agent.learning import (
    TopicInfo,
    build_study_plan,
    choose_topic_thompson,
    compute_streak,
    hash_string,
    local_day,
    mulberry32,
    parse_ts,
    sample_beta,
    specialty_stats,
    topic_stats,
    weakest_topic,
)
from razona_agent.models import Outcome

NOW = datetime.fromisoformat("2026-11-20T18:00:00-06:00")


def days_ago(n: int) -> datetime:
    return NOW - timedelta(days=n)


def outcomes(topic: str, spec: str, correct: int, total: int) -> list[Outcome]:
    return [
        Outcome(topic=topic, specialty_id=spec, is_correct=i < correct, at=days_ago(1).isoformat())
        for i in range(total)
    ]


DATA = (
    outcomes("Bronquiolitis", "pediatria", 2, 9)
    + outcomes("Hipertensión arterial", "medicina-interna", 7, 9)
    + outcomes("Apendicitis aguda", "cirugia-general", 6, 8)
)


# Reference values computed with the TS implementation (tsx lib/learning/*.ts).
def test_mulberry32_matches_typescript():
    r = mulberry32(42)
    assert [r(), r(), r()] == [0.6011037519201636, 0.44829055899754167, 0.8524657934904099]


def test_hash_string_matches_typescript():
    assert hash_string("ebb228d9-8823-4f2b-b0a0-72df1196f949:52") == 1132515882
    assert hash_string("Pediatría ñ") == 773517675


def test_sample_beta_matches_typescript():
    r = mulberry32(7)
    assert abs(sample_beta(1.5, 3, r) - 0.6059277124487857) < 1e-12
    assert abs(sample_beta(0.5, 2, r) - 0.2248401142523376) < 1e-12


def test_thompson_matches_typescript_choices():
    stats = topic_stats(DATA)
    topics = ["Bronquiolitis", "Hipertensión arterial", "Apendicitis aguda", "Nuevo"]
    expected = [
        "Hipertensión arterial", "Bronquiolitis", "Nuevo", "Bronquiolitis", "Bronquiolitis",
        "Bronquiolitis", "Bronquiolitis", "Bronquiolitis", "Bronquiolitis", "Nuevo",
        "Bronquiolitis", "Nuevo",
    ]
    assert [choose_topic_thompson(topics, stats, s) for s in range(1, 13)] == expected


def test_thompson_prefers_weak_topic_and_is_deterministic():
    stats = topic_stats(DATA)
    topics = ["Bronquiolitis", "Hipertensión arterial", "Apendicitis aguda"]
    weak_first = sum(choose_topic_thompson(topics, stats, s) == "Bronquiolitis" for s in range(1, 501))
    assert weak_first / 500 > 0.9
    assert choose_topic_thompson(topics, stats, 42) == choose_topic_thompson(topics, stats, 42)


def test_mastery_is_beta_posterior_mean():
    s = next(s for s in topic_stats(DATA) if s.topic == "Bronquiolitis")
    assert (s.correct, s.total) == (2, 9)
    assert s.mastery == (2 + 1) / (9 + 2)


def test_weakest_topic_and_min_attempts():
    assert weakest_topic(topic_stats(DATA)).topic == "Bronquiolitis"
    assert weakest_topic(topic_stats(outcomes("X", "pediatria", 0, 2))) is None


def test_specialty_stats():
    ped = next(s for s in specialty_stats(DATA) if s.specialty_id == "pediatria")
    assert (ped.correct, ped.total) == (2, 9)


def test_streak_counts_until_yesterday_and_today():
    assert compute_streak([days_ago(n) for n in range(1, 7)], NOW).current == 6
    s = compute_streak([days_ago(n) for n in range(0, 7)], NOW)
    assert s.current == 7 and s.active_today
    assert compute_streak([days_ago(2), days_ago(3)], NOW).current == 0


def test_streak_uses_mexico_city_and_last_seven_days():
    assert local_day(datetime(2026, 11, 21, 3, 0, tzinfo=timezone.utc)) == "2026-11-20"
    s = compute_streak([days_ago(0)], NOW)
    assert len(s.last_seven_days) == 7
    assert s.last_seven_days[-1].model_dump() == {"day": "2026-11-20", "active": True}


def test_parse_ts_variants():
    assert parse_ts("2026-11-18T02:13:00+00:00") == parse_ts("2026-11-18 02:13:00Z")
    assert parse_ts("2026-11-18T02:13:00.12345+00:00").microsecond == 123450


CATALOG = [
    TopicInfo(topic="Hipertensión arterial", specialty_id="medicina-interna", specialty_name="MI",
              case_item_id="caso-hta", case_title="HTA", item_count=2),
    TopicInfo(topic="Hipotiroidismo", specialty_id="medicina-interna", specialty_name="MI", item_count=1),
    TopicInfo(topic="Bronquiolitis", specialty_id="pediatria", specialty_name="Ped",
              case_item_id="caso-bq", case_title="BQ", item_count=3),
    TopicInfo(topic="Apendicitis aguda", specialty_id="cirugia-general", specialty_name="Cx", item_count=1),
]


def test_study_plan_is_deterministic_and_prioritized():
    stats = topic_stats(DATA)
    plan = build_study_plan(stats, CATALOG, 7, date(2026, 11, 20))
    again = build_study_plan(stats, CATALOG, 7, date(2026, 11, 20))
    assert plan == again
    assert plan.weak_topic == "Bronquiolitis"
    # weak first, then new (Hipotiroidismo), then mastered by mastery (Apendicitis 70 %, HTA 73 %)
    assert plan.priority_topics == [
        "Bronquiolitis", "Hipotiroidismo", "Apendicitis aguda", "Hipertensión arterial",
    ]
    assert len(plan.schedule) == 7
    assert plan.schedule[0].topic == "Bronquiolitis"
    assert plan.schedule[0].practice_case_id == "caso-bq"
    assert plan.schedule[0].date == "2026-11-20"
    assert plan.schedule[-1].is_mock_exam and plan.schedule[-1].date == "2026-11-26"


def test_study_plan_clamps_days_and_short_plans_have_no_mock():
    plan = build_study_plan([], CATALOG, 2, date(2026, 11, 20))
    assert len(plan.schedule) == 2 and not any(d.is_mock_exam for d in plan.schedule)
    assert build_study_plan([], CATALOG, 999, date(2026, 11, 20)).days == 30
    assert build_study_plan([], CATALOG, 0, date(2026, 11, 20)).days == 1
