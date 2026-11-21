"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { track } from "@/lib/analytics/events";
import { ExamStartResponseSchema } from "@/lib/schemas/api";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string; count: number };

type Props = {
  groups: Option[];
  topics: (Option & { groupName: string })[];
  globalCount: number;
};

type Scope = "global" | "grupo" | "tema";

const SCOPES: { id: Scope; label: string }[] = [
  { id: "global", label: "Global" },
  { id: "grupo", label: "Por área" },
  { id: "tema", label: "Por tema" },
];

const selectClass =
  "h-12 w-full rounded-lg border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function StartExamButton({ groups, topics, globalCount }: Props) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("global");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [topicId, setTopicId] = useState(topics[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count =
    scope === "global"
      ? globalCount
      : scope === "grupo"
        ? (groups.find((g) => g.id === groupId)?.count ?? 0)
        : (topics.find((t) => t.id === topicId)?.count ?? 0);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const body =
        scope === "global" ? { scope } : { scope, ref: scope === "grupo" ? groupId : topicId };
      const res = await fetch("/api/exam/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { examId } = ExamStartResponseSchema.parse(await res.json());
      track("exam_started", { examId, scope });
      router.push(`/examen/${examId}`);
    } catch {
      setError("No se pudo iniciar el examen. Intenta de nuevo.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <fieldset className="grid grid-cols-3 gap-2">
        <legend className="sr-only">Alcance del examen</legend>
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={scope === s.id}
            data-testid={`exam-scope-${s.id}`}
            onClick={() => setScope(s.id)}
            className={cn(
              "min-h-11 rounded-lg border px-2 text-sm font-semibold transition-colors",
              scope === s.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background hover:bg-accent",
            )}
          >
            {s.label}
          </button>
        ))}
      </fieldset>

      {scope === "grupo" && (
        <div className="space-y-1.5">
          <Label htmlFor="exam-group">Área</Label>
          <select
            id="exam-group"
            className={selectClass}
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            data-testid="exam-group"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {scope === "tema" && (
        <div className="space-y-1.5">
          <Label htmlFor="exam-topic">Tema</Label>
          <select
            id="exam-topic"
            className={selectClass}
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            data-testid="exam-topic"
          >
            {groups.map((g) => (
              <optgroup key={g.id} label={g.name}>
                {topics
                  .filter((t) => t.groupName === g.name)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Cada tema tiene 2 casos (el original y una variante), así que el examen es corto.
          </p>
        </div>
      )}

      <p className="text-sm text-muted-foreground" data-testid="exam-count">
        {count} {count === 1 ? "reactivo" : "reactivos"} · {Math.ceil((count * 90) / 60)} minutos
      </p>

      <Button
        size="lg"
        className="w-full"
        onClick={() => void start()}
        disabled={pending || count === 0}
        data-testid="start-exam"
      >
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Comenzar examen
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
