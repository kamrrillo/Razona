import { Bot, ChevronRight, Clock, ListChecks, MicOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCatalog } from "@/lib/content";
import { getAuthedContext } from "@/lib/data/auth";
import { EXAM_SIZE, SECONDS_PER_ITEM } from "@/lib/data/exam";
import { getStudyGroup } from "@/lib/data/study-group";
import { StartExamButton } from "./start-exam-button";

export const metadata: Metadata = { title: "Examen simulado" };

export default async function ExamenPage() {
  const ctx = await getAuthedContext();
  const [catalog, group] = await Promise.all([
    getCatalog(),
    ctx ? getStudyGroup(ctx.supabase, ctx.userId) : Promise.resolve("ia" as const),
  ]);
  const count = (pred: (i: (typeof catalog.items)[number]) => boolean) =>
    catalog.items.filter(pred).length;
  const groups = catalog.groups
    .map((g) => ({
      id: g.id,
      name: g.name,
      count: Math.min(
        EXAM_SIZE,
        count((i) => i.groupId === g.id),
      ),
    }))
    .filter((g) => g.count > 0);
  const groupName = new Map(catalog.groups.map((g) => [g.id, g.name]));
  const topics = catalog.topics
    .map((t) => ({
      id: t.sindrome,
      name: t.name,
      groupName: groupName.get(t.groupId) ?? "",
      count: count((i) => i.sindrome === t.sindrome),
    }))
    .filter((t) => t.count > 0);
  const globalCount = Math.min(EXAM_SIZE, catalog.items.length);

  return (
    <div className="space-y-4 py-4">
      <h1 className="text-2xl font-bold">Examen</h1>
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Examen simulado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <ListChecks className="size-5 text-primary" aria-hidden /> Hasta {EXAM_SIZE}{" "}
              reactivos: global (todas las áreas), por área o por tema
            </li>
            <li className="flex items-center gap-3">
              <Clock className="size-5 text-primary" aria-hidden /> {SECONDS_PER_ITEM} segundos por
              reactivo, con cronómetro
            </li>
            <li className="flex items-center gap-3">
              <MicOff className="size-5 text-primary" aria-hidden /> Tutor apagado: como el día del
              ENARM
            </li>
          </ul>
          <StartExamButton groups={groups} topics={topics} globalCount={globalCount} />
        </CardContent>
      </Card>
      {group === "ia" && (
        <Link
          href="/diagnostico"
          data-testid="open-diagnostic"
          className="flex min-h-16 items-center gap-3 rounded-2xl bg-brand-gradient p-4 text-white shadow-[0_5px_0_0_var(--color-brand-800)] transition-transform active:translate-y-1"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Bot className="size-6" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block font-bold">Diagnóstico con IA</span>
            <span className="block text-sm text-brand-50">
              Un agente arma tu examen y te explica tus resultados
            </span>
          </span>
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
