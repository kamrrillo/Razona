import { Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Progress } from "@/lib/schemas/api";
import { cn } from "@/lib/utils";

const WEEKDAY = new Intl.DateTimeFormat("es-MX", { weekday: "narrow", timeZone: "UTC" });

export function StreakCard({ streak }: { streak: Progress["streak"] }) {
  return (
    <Card data-testid="streak-card">
      <CardContent className="flex items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
          <Flame className="size-8" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Racha</p>
          <p className="text-2xl font-bold">
            <span data-testid="streak-count">{streak.current}</span>{" "}
            {streak.current === 1 ? "día" : "días"}
          </p>
          <p className="text-xs text-muted-foreground">
            {streak.activeToday ? "¡Ya practicaste hoy!" : "Practica hoy para mantenerla"}
          </p>
        </div>
        <ol className="flex gap-1" aria-label="Últimos 7 días">
          {streak.lastSevenDays.map((d) => (
            <li key={d.day} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "size-3 rounded-full",
                  d.active ? "bg-orange-500" : "bg-muted-foreground/20",
                )}
                title={d.day}
              />
              <span className="text-[10px] uppercase text-muted-foreground">
                {WEEKDAY.format(new Date(`${d.day}T12:00:00Z`))}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
