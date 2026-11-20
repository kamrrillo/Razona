import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SpecialtyBars } from "@/components/app/specialty-bars";
import { StreakCard } from "@/components/app/streak-card";
import { WeakTopicCard } from "@/components/app/weak-topic-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthedContext } from "@/lib/data/auth";
import { getProgress } from "@/lib/data/progress";

export const metadata: Metadata = { title: "Progreso" };

const DATE = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  timeZone: "America/Mexico_City",
});

export default async function ProgresoPage() {
  const ctx = await getAuthedContext();
  if (!ctx) redirect("/login");
  const progress = await getProgress(ctx.supabase, ctx.userId);
  const accuracy =
    progress.totals.answered === 0
      ? 0
      : Math.round((progress.totals.correct / progress.totals.answered) * 100);

  return (
    <div className="space-y-4 py-4">
      <h1 className="text-2xl font-bold">Tu progreso</h1>
      <StreakCard streak={progress.streak} />

      <div className="grid grid-cols-3 gap-2 text-center">
        <Card size="sm">
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{progress.totals.answered}</p>
            <p className="text-xs text-muted-foreground">respondidos</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{accuracy} %</p>
            <p className="text-xs text-muted-foreground">aciertos</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-2xl font-bold tabular-nums" data-testid="answered-today">
              {progress.totals.answeredToday}
            </p>
            <p className="text-xs text-muted-foreground">hoy</p>
          </CardContent>
        </Card>
      </div>

      <WeakTopicCard weakTopic={progress.weakTopic} showDelta />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por especialidad</CardTitle>
        </CardHeader>
        <CardContent>
          <SpecialtyBars items={progress.bySpecialty} />
        </CardContent>
      </Card>

      {progress.recentExams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exámenes recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {progress.recentExams.map((e) => (
                <li key={e.id} className="flex justify-between py-2 text-sm">
                  <span>{DATE.format(new Date(e.finishedAt))}</span>
                  <span className="tabular-nums">
                    {Math.round(e.score)} · {e.correct}/{e.total}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <form action="/auth/logout" method="post">
        <button
          type="submit"
          className="min-h-11 w-full text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
