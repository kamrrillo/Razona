"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/events";
import { ExamStartResponseSchema } from "@/lib/schemas/api";

export function StartExamButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/exam/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error(String(res.status));
      const { examId } = ExamStartResponseSchema.parse(await res.json());
      track("exam_started", { examId });
      router.push(`/examen/${examId}`);
    } catch {
      setError("No se pudo iniciar el examen. Intenta de nuevo.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button size="lg" className="w-full" onClick={() => void start()} disabled={pending} data-testid="start-exam">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Comenzar examen
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
