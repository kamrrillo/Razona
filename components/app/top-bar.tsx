import { Flame, LogOut, Target } from "lucide-react";
import { LogoMark } from "@/components/app/logo";
import { cn } from "@/lib/utils";

export const DAILY_GOAL = 5;

export function TopBar({
  streak,
  activeToday,
  answeredToday,
}: {
  streak: number;
  activeToday: boolean;
  answeredToday: number;
}) {
  const goalDone = answeredToday >= DAILY_GOAL;
  return (
    <div className="sticky top-[calc(env(safe-area-inset-top)+1.75rem)] z-30 -mx-4 -mt-2 flex items-center justify-between border-b border-brand-100 bg-background/90 px-4 py-2 backdrop-blur">
      <span className="flex items-center gap-2">
        <LogoMark className="size-9" />
        <span className="text-lg font-extrabold tracking-tight text-brand-900">
          Razon<span className="text-aqua-500">a</span>
        </span>
      </span>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-9 items-center gap-1 rounded-full px-3 text-sm font-bold",
            activeToday ? "bg-orange-100 text-orange-600" : "bg-muted text-muted-foreground",
          )}
          title="Racha"
        >
          <Flame className={cn("size-4", activeToday && "fill-orange-400")} aria-hidden />
          <span data-testid="streak-count">{streak}</span>
          <span className="sr-only">días de racha</span>
        </span>
        <span
          className={cn(
            "flex h-9 items-center gap-1 rounded-full px-3 text-sm font-bold",
            goalDone ? "bg-aqua-200 text-aqua-700" : "bg-brand-50 text-brand-700",
          )}
          title="Meta diaria"
        >
          <Target className="size-4" aria-hidden />
          {Math.min(answeredToday, DAILY_GOAL)}/{DAILY_GOAL}
          <span className="sr-only">respuestas de la meta diaria</span>
        </span>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            title="Cerrar sesión"
            data-testid="logout"
            // Se ve de 36 px como los otros chips, pero el área táctil es de 44 px.
            className="relative flex size-9 items-center justify-center rounded-full bg-muted after:absolute after:-inset-1 after:content-[''] text-muted-foreground transition-colors hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            <LogOut className="size-4" aria-hidden />
            <span className="sr-only">Cerrar sesión</span>
          </button>
        </form>
      </div>
    </div>
  );
}
