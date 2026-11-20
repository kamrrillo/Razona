import { Timer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SpecialtyBars } from "@/components/app/specialty-bars";
import { StreakCard } from "@/components/app/streak-card";
import { WeakTopicCard } from "@/components/app/weak-topic-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthedContext } from "@/lib/data/auth";
import { getProgress } from "@/lib/data/progress";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Inicio" };

export default async function InicioPage() {
  const ctx = await getAuthedContext();
  if (!ctx) redirect("/login");
  const progress = await getProgress(ctx.supabase, ctx.userId);
  const name = progress.displayName || "Hola";

  return (
    <div className="space-y-4 py-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Preparación ENARM</p>
          <h1 className="text-2xl font-bold">¡Hola, {name}!</h1>
        </div>
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            className="min-h-11 px-2 text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Salir
          </button>
        </form>
      </header>

      <StreakCard streak={progress.streak} />
      <WeakTopicCard weakTopic={progress.weakTopic} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avance por especialidad</CardTitle>
        </CardHeader>
        <CardContent>
          <SpecialtyBars items={progress.bySpecialty} />
        </CardContent>
      </Card>

      <Link
        href="/examen"
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
      >
        <Timer aria-hidden /> Examen simulado (10 reactivos)
      </Link>
    </div>
  );
}
