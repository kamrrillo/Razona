import { Clock, ListChecks, MicOff } from "lucide-react";
import type { Metadata } from "next";
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
              <ListChecks className="size-5 text-primary" aria-hidden /> {examFile.items.length} reactivos
              de varias especialidades
            </li>
            <li className="flex items-center gap-3">
              <Clock className="size-5 text-primary" aria-hidden /> {examFile.durationMinutes} minutos con
              cronómetro
            </li>
            <li className="flex items-center gap-3">
              <MicOff className="size-5 text-primary" aria-hidden /> Tutor apagado: como el día del ENARM
            </li>
          </ul>
          <StartExamButton />
        </CardContent>
      </Card>
    </div>
  );
}
