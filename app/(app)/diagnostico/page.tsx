import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedContext } from "@/lib/data/auth";
import { getStudyGroup } from "@/lib/data/study-group";
import { DiagnosticSession } from "./diagnostic-session";

export const metadata: Metadata = { title: "Diagnóstico con IA" };

export default async function DiagnosticoPage() {
  const ctx = await getAuthedContext();
  if (!ctx) redirect("/login?next=/diagnostico");
  // El grupo control del estudio no usa IA.
  if ((await getStudyGroup(ctx.supabase, ctx.userId)) === "control") redirect("/inicio");
  return <DiagnosticSession />;
}
