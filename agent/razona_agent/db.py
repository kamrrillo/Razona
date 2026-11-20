"""Repository over Supabase (supabase-py / PostgREST, service role).

The service role key BYPASSES RLS, so every query on user data filters by
``user_id`` explicitly. Methods that touch user rows take ``user_id`` as their
first argument and always add ``.eq("user_id", user_id)``.

Items and specialties are global content; they are cached in-process because
they only change when someone runs ``pnpm seed:demo``.
"""

from __future__ import annotations

import re
import threading
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ValidationError
from supabase import Client, create_client

from .config import Settings, get_settings
from .models import Item, Outcome, Specialty

_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def is_uuid(value: str) -> bool:
    return bool(_UUID_RE.match(value or ""))


class DatabaseConfigError(RuntimeError):
    """Raised with a Spanish message when Supabase is not configured."""


class ExamRow(BaseModel):
    id: str
    exam_key: str
    started_at: str
    finished_at: str | None
    duration_seconds: int
    total: int | None
    correct: int | None
    score: float | None


class ExamAnswerRow(BaseModel):
    item_id: str
    specialty_id: str
    topic: str
    selected_option: str
    is_correct: bool


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class RazonaRepository:
    def __init__(self, client: Client):
        self._client = client
        self._lock = threading.Lock()
        self._items: dict[str, Item] | None = None
        self._specialties: list[Specialty] | None = None

    # ------------------------------------------------------------------ content (global)

    def list_specialties(self) -> list[Specialty]:
        with self._lock:
            if self._specialties is None:
                res = (
                    self._client.table("specialties")
                    .select("id, name, sort_order")
                    .order("sort_order")
                    .execute()
                )
                self._specialties = [Specialty.model_validate(r) for r in res.data]
            return list(self._specialties)

    def specialty_name(self, specialty_id: str) -> str:
        return next((s.name for s in self.list_specialties() if s.id == specialty_id), specialty_id)

    def _load_items(self) -> dict[str, Item]:
        with self._lock:
            if self._items is None:
                res = self._client.table("items").select("id, payload").order("id").execute()
                items: dict[str, Item] = {}
                for row in res.data:
                    try:
                        items[row["id"]] = Item.model_validate(row["payload"])
                    except ValidationError as exc:  # pragma: no cover - bad seed data
                        raise ValueError(f"items.payload inválido para {row['id']}: {exc}") from exc
                self._items = items
            return self._items

    def list_items(self, kind: str | None = None) -> list[Item]:
        items = list(self._load_items().values())
        return [i for i in items if kind is None or i.kind == kind]

    def get_item(self, item_id: str) -> Item | None:
        return self._load_items().get(item_id)

    def refresh_content(self) -> None:
        with self._lock:
            self._items = None
            self._specialties = None

    # ------------------------------------------------------------------ users

    def find_user_id_by_email(self, email: str) -> str | None:
        target = email.strip().lower()
        page = 1
        while True:
            users = self._client.auth.admin.list_users(page=page, per_page=200)
            for u in users:
                if (u.email or "").lower() == target:
                    return u.id
            if len(users) < 200:
                return None
            page += 1

    def get_profile(self, user_id: str) -> dict[str, Any] | None:
        res = (
            self._client.table("profiles")
            .select("id, display_name")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        return res.data if res is not None else None

    # ------------------------------------------------------------------ history (user-scoped)

    def load_outcomes(self, user_id: str) -> list[Outcome]:
        """Practice attempts + answers of FINISHED exams (same as lib/data/progress.ts)."""
        attempts = (
            self._client.table("attempts")
            .select("topic, specialty_id, is_correct, created_at")
            .eq("user_id", user_id)
            .order("created_at")
            .limit(5000)
            .execute()
        )
        answers = (
            self._client.table("exam_answers")
            .select("topic, specialty_id, is_correct, answered_at, exams!inner(finished_at)")
            .eq("user_id", user_id)
            .not_.is_("exams.finished_at", "null")
            .limit(5000)
            .execute()
        )
        return [
            Outcome(
                topic=a["topic"],
                specialty_id=a["specialty_id"],
                is_correct=a["is_correct"],
                at=a["created_at"],
            )
            for a in attempts.data
        ] + [
            Outcome(
                topic=a["topic"],
                specialty_id=a["specialty_id"],
                is_correct=a["is_correct"],
                at=a["answered_at"],
            )
            for a in answers.data
        ]

    def recent_exams(self, user_id: str, limit: int = 5) -> list[ExamRow]:
        res = (
            self._client.table("exams")
            .select("id, exam_key, started_at, finished_at, duration_seconds, total, correct, score")
            .eq("user_id", user_id)
            .not_.is_("finished_at", "null")
            .order("finished_at", desc=True)
            .limit(limit)
            .execute()
        )
        return [ExamRow.model_validate(r) for r in res.data]

    def insert_attempt(
        self,
        user_id: str,
        item: Item,
        selected_option: str,
        is_correct: bool,
        used_tutor: bool = True,
    ) -> str:
        res = (
            self._client.table("attempts")
            .insert(
                {
                    "user_id": user_id,
                    "session_id": None,
                    "item_id": item.id,
                    "specialty_id": item.specialty_id,
                    "topic": item.topic,
                    "selected_option": selected_option,
                    "is_correct": is_correct,
                    "used_tutor": used_tutor,
                }
            )
            .execute()
        )
        return res.data[0]["id"]

    # ------------------------------------------------------------------ exams (user-scoped)

    def create_exam(self, user_id: str, exam_key: str, duration_seconds: int) -> str:
        res = (
            self._client.table("exams")
            .insert(
                {"user_id": user_id, "exam_key": exam_key, "duration_seconds": duration_seconds}
            )
            .execute()
        )
        return res.data[0]["id"]

    def get_exam(self, user_id: str, exam_id: str) -> ExamRow | None:
        if not is_uuid(exam_id):
            return None
        res = (
            self._client.table("exams")
            .select("id, exam_key, started_at, finished_at, duration_seconds, total, correct, score")
            .eq("id", exam_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return ExamRow.model_validate(res.data[0]) if res.data else None

    def exam_answers(self, user_id: str, exam_id: str) -> list[ExamAnswerRow]:
        res = (
            self._client.table("exam_answers")
            .select("item_id, specialty_id, topic, selected_option, is_correct")
            .eq("exam_id", exam_id)
            .eq("user_id", user_id)
            .execute()
        )
        return [ExamAnswerRow.model_validate(r) for r in res.data]

    def upsert_exam_answer(
        self, user_id: str, exam_id: str, item: Item, selected_option: str, is_correct: bool
    ) -> None:
        (
            self._client.table("exam_answers")
            .upsert(
                {
                    "exam_id": exam_id,
                    "user_id": user_id,
                    "item_id": item.id,
                    "specialty_id": item.specialty_id,
                    "topic": item.topic,
                    "selected_option": selected_option,
                    "is_correct": is_correct,
                    "answered_at": _now_iso(),
                },
                on_conflict="exam_id,item_id",
            )
            .execute()
        )

    def finish_exam(
        self, user_id: str, exam_id: str, total: int, correct: int, score: float
    ) -> None:
        (
            self._client.table("exams")
            .update(
                {"finished_at": _now_iso(), "total": total, "correct": correct, "score": score}
            )
            .eq("id", exam_id)
            .eq("user_id", user_id)
            .execute()
        )

    # ------------------------------------------------------------------ cleanup (tests)

    def delete_exam(self, user_id: str, exam_id: str) -> None:
        """Deletes an exam of this user (its answers cascade)."""
        self._client.table("exams").delete().eq("id", exam_id).eq("user_id", user_id).execute()

    def delete_attempts(self, user_id: str, attempt_ids: list[str]) -> None:
        if attempt_ids:
            (
                self._client.table("attempts")
                .delete()
                .in_("id", attempt_ids)
                .eq("user_id", user_id)
                .execute()
            )


_repo: RazonaRepository | None = None
_repo_lock = threading.Lock()


def build_client(settings: Settings) -> Client:
    if not settings.supabase_url or not settings.supabase_secret_key:
        raise DatabaseConfigError(
            "Falta configurar Supabase. Define SUPABASE_URL y SUPABASE_SECRET_KEY "
            "(service role, solo servidor) en agent/.env, o ten NEXT_PUBLIC_SUPABASE_URL y "
            "SUPABASE_SECRET_KEY en el .env.local del repo."
        )
    return create_client(settings.supabase_url, settings.supabase_secret_key)


def get_repository() -> RazonaRepository:
    """Lazy process-wide repository (no network until the first query)."""
    global _repo
    with _repo_lock:
        if _repo is None:
            _repo = RazonaRepository(build_client(get_settings()))
        return _repo


def set_repository(repo: RazonaRepository | None) -> None:
    """Overrides the repository (tests)."""
    global _repo
    with _repo_lock:
        _repo = repo
