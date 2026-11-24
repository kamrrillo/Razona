import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedContext } from "@/lib/data/auth";
import { getStudyProgress } from "@/lib/data/study";
import { getStudyGroup } from "@/lib/data/study-group";
import { PracticeSession } from "./practice-session";

export const metadata: Metadata = { title: "Practicar" };

export default async function PracticarPage({ searchParams }: PageProps<"/practicar">) {
  const params = await searchParams;
  const ctx = await getAuthedContext();
  if (!ctx) redirect("/login?next=/practicar");
  // Participante del estudio que ya respondió todo: pantalla final.
  if (ctx.isAnonymous && (await getStudyProgress(ctx.supabase, ctx.userId)).done) {
    redirect("/estudio/fin");
  }
  const quizOnly = (await getStudyGroup(ctx.supabase, ctx.userId)) === "control";
  const topic = typeof params.topic === "string" ? params.topic : undefined;
  // `key` reinicia la sesión cuando cambia el tema solicitado.
  return <PracticeSession key={topic ?? "auto"} topic={topic} quizOnly={quizOnly} />;
}
