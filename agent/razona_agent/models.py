"""Pydantic models.

``Item`` mirrors the Zod ``ItemSchema`` in ``lib/schemas/content.ts`` (camelCase JSON in
``v_casos_app.payload``: the case bank json/casos translated by the database view). Tool outputs are plain Pydantic models dumped to JSON-safe dicts.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

SAMPLE_NOTICE = "Uso educativo: no sustituye el criterio clínico."

OptionId = str  # validated with the regex below where it matters
_OPTION_PATTERN = r"^[a-e]$"


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)


class Specialty(_Camel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    sort_order: int = 0


class Option(_Camel):
    id: str = Field(pattern=_OPTION_PATTERN)
    text: str = Field(min_length=1)


class Citation(_Camel):
    gpc_id: str = Field(min_length=1)
    gpc_title: str = Field(min_length=1)
    section: str = Field(min_length=1)
    page: int | None = None
    snippet: str = Field(min_length=1)


class RubricEntry(_Camel):
    """Entrada de la rúbrica del banco. Revela la respuesta por descarte: solo servidor."""

    error_type: Literal["lectura", "dato_omitido", "razonamiento", "conocimiento"]
    description: str
    option_ids: list[str]
    question: str
    explanation: str
    citation: Citation


class KeyPoint(_Camel):
    text: str
    citation: Citation


class Item(_Camel):
    """Full item (includes the correct answer). Never send it as-is to the student."""

    id: str = Field(min_length=1)
    kind: Literal["case", "exam"]
    specialty_id: str = Field(min_length=1)
    topic: str = Field(min_length=1)
    title: str = Field(min_length=1)
    vignette: str = Field(min_length=1)
    question: str = Field(min_length=1)
    options: list[Option] = Field(min_length=3, max_length=5)
    correct_option_id: str = Field(pattern=_OPTION_PATTERN)
    explanation: str = Field(min_length=1)
    citation: Citation
    is_sample: bool
    # Campos del banco de casos (opcionales, como en Zod).
    specialty_name: str | None = None
    tipo: Literal["indice", "variante"] | None = None
    caso_indice_id: str | None = None
    sindrome: str | None = None
    group_id: str | None = None
    group_name: str | None = None
    key_points: list[KeyPoint] = Field(default_factory=list)
    rubric: list[RubricEntry] = Field(default_factory=list)

    def rubric_for(self, option_id: str) -> RubricEntry | None:
        """Entrada de la rúbrica de una opción incorrecta (nunca de la correcta)."""
        if option_id == self.correct_option_id:
            return None
        return next((r for r in self.rubric if option_id in r.option_ids), None)

    @model_validator(mode="after")
    def _correct_option_exists(self) -> Item:
        if not any(o.id == self.correct_option_id for o in self.options):
            raise ValueError("correctOptionId debe existir en options")
        return self

    def option(self, option_id: str) -> Option | None:
        return next((o for o in self.options if o.id == option_id), None)

    @property
    def correct_option(self) -> Option:
        return next(o for o in self.options if o.id == self.correct_option_id)

    def to_public(self, specialty_name: str) -> PublicItem:
        return PublicItem(
            id=self.id,
            kind=self.kind,
            specialty_id=self.specialty_id,
            specialty_name=specialty_name,
            topic=self.topic,
            title=self.title,
            vignette=self.vignette,
            question=self.question,
            options=list(self.options),
            is_sample=self.is_sample,
        )


class PublicItem(BaseModel):
    """What the student sees before answering: no answer, explanation or citation."""

    id: str
    kind: Literal["case", "exam"]
    specialty_id: str
    specialty_name: str
    topic: str
    title: str
    vignette: str
    question: str
    options: list[Option]
    is_sample: bool
    aviso: str = SAMPLE_NOTICE


# --------------------------------------------------------------------------- learning


class Outcome(BaseModel):
    topic: str
    specialty_id: str
    is_correct: bool
    at: str  # ISO timestamp


class TopicStat(BaseModel):
    topic: str
    specialty_id: str
    correct: int
    total: int
    mastery: float
    """Posterior mean of Beta(1 + correct, 1 + errors) = (correct + 1) / (total + 2)."""


class SpecialtyStat(BaseModel):
    specialty_id: str
    name: str = ""
    correct: int
    total: int
    accuracy: float


class StreakDay(BaseModel):
    day: str
    active: bool


class Streak(BaseModel):
    current: int
    active_today: bool
    last_seven_days: list[StreakDay]


# --------------------------------------------------------------------------- tool outputs


class WeakTopic(BaseModel):
    topic: str
    specialty_id: str
    specialty_name: str
    correct: int
    total: int
    mastery: float
    has_case: bool


class ExamSummary(BaseModel):
    id: str
    exam_key: str
    finished_at: str
    score: float
    correct: int
    total: int


class Progress(BaseModel):
    nombre: str
    totals_answered: int
    totals_correct: int
    answered_today: int
    streak: Streak
    by_specialty: list[SpecialtyStat]
    by_topic: list[TopicStat]
    weak_topic: WeakTopic | None
    recent_exams: list[ExamSummary]


class ItemReview(BaseModel):
    item_id: str
    topic: str
    specialty_id: str
    question: str
    selected_option: str | None
    correct_option: str
    correct_option_text: str
    is_correct: bool
    explanation: str
    citation: Citation


class DiagnosticResult(BaseModel):
    exam_id: str
    total: int
    answered: int
    correct: int
    score: float
    by_specialty: list[SpecialtyStat]
    by_topic: list[TopicStat]
    weak_topics: list[TopicStat]
    """Topics of this diagnostic with errors, weakest first."""
    overall_weak_topic: WeakTopic | None
    """Weak topic across the full history (attempts + finished exams), incl. this one."""
    review: list[ItemReview]
    aviso: str = SAMPLE_NOTICE


class GpcReading(BaseModel):
    gpc_id: str
    gpc_title: str
    section: str


class StudyDay(BaseModel):
    day_number: int
    date: str
    topic: str
    specialty_id: str
    specialty_name: str
    reason: str
    mastery: float | None
    practice_case_id: str | None
    practice_case_title: str | None
    review_item_count: int
    gpc_readings: list[GpcReading]
    minutes: int
    goal: str
    is_mock_exam: bool = False


class StudyPlan(BaseModel):
    days: int
    start_date: str
    weak_topic: str | None
    priority_topics: list[str]
    schedule: list[StudyDay]
    aviso: str = SAMPLE_NOTICE
