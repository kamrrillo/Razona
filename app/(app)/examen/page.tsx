import { Bot, ChevronRight, Clock, ListChecks, MicOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SampleContentBadge } from "@/components/app/sample-content-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { examFile } from "@/lib/content";
import { StartExamButton } from "./start-exam-button";

export const metadata: Metadata = { title: "Examen simulado" };

export default function ExamenPage() {
  return (
    <div className="space-y-4 py-4">
      <h1 className="text-2xl font-bold">Examen simulado</h1>
      <Card>
        <CardHeader className="space-y-2">
          <SampleContentBadge />
          <CardTitle>{examFile.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <ListChecks className="size-5 text-primary" aria-hidden /> {examFile.items.length}{" "}
              reactivos de varias especialidades
            </li>
            <li className="flex items-center gap-3">
              <Clock className="size-5 text-primary" aria-hidden /> {examFile.durationMinutes}{" "}
              minutos con cronómetro
            </li>
            <li className="flex items-center gap-3">
              <MicOff className="size-5 text-primary" aria-hidden /> Tutor apagado: como el día del
              ENARM
            </li>
          </ul>
          <StartExamButton />
        </CardContent>
      </Card>
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
    </div>
  );
}
