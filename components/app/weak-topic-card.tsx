import { Target, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Progress } from "@/lib/schemas/api";
import { cn } from "@/lib/utils";

export function WeakTopicCard({
  weakTopic,
  showDelta = false,
}: {
  weakTopic: Progress["weakTopic"];
  showDelta?: boolean;
}) {
  if (!weakTopic) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          Resuelve algunos casos para detectar tu tema débil.
        </CardContent>
      </Card>
    );
  }
  const pct = Math.round(weakTopic.mastery * 100);
  const before =
    weakTopic.masteryBeforeToday === null ? null : Math.round(weakTopic.masteryBeforeToday * 100);
  const delta = before === null ? 0 : pct - before;

  return (
    <Card data-testid="weak-topic-card" className="border-rose-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="size-5 text-rose-600" aria-hidden /> Tu tema débil
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xl font-semibold" data-testid="weak-topic-name">
            {weakTopic.topic}
          </p>
          <p className="text-sm text-muted-foreground">
            {weakTopic.specialtyName} · {weakTopic.correct}/{weakTopic.total} aciertos · dominio{" "}
            <span data-testid="weak-topic-mastery">{pct} %</span>
          </p>
          {showDelta && delta !== 0 && (
            <p
              className={cn(
                "mt-1 flex items-center gap-1 text-sm font-medium",
                delta > 0 ? "text-emerald-700" : "text-rose-700",
              )}
              data-testid="weak-topic-delta"
            >
              {delta > 0 ? (
                <TrendingUp className="size-4" aria-hidden />
              ) : (
                <TrendingDown className="size-4" aria-hidden />
              )}
              {delta > 0 ? "+" : ""}
              {delta} pts hoy (antes {before} %)
            </p>
          )}
        </div>
        <Link
          href="/practicar?topic=weak"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
          data-testid="practice-weak-topic"
        >
          Practicar mi tema débil
        </Link>
      </CardContent>
    </Card>
  );
}
