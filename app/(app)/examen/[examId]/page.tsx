import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCatalog, toPublicItem } from "@/lib/content";
import { getAuthedContext } from "@/lib/data/auth";
import { examItemsFor, examTitle, loadExam } from "@/lib/data/exam";
import { publicEnv } from "@/lib/env";
import { ExamRunner } from "./exam-runner";

export const metadata: Metadata = { title: "Examen en curso" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ExamRunPage({ params }: PageProps<"/examen/[examId]">) {
  const { examId } = await params;
  if (!UUID.test(examId)) notFound();
  const ctx = await getAuthedContext();
  if (!ctx) redirect("/login");
  const loaded = await loadExam(ctx.supabase, ctx.userId, examId);
  if (!loaded) notFound();
  if (loaded.exam.finishedAt) redirect(`/examen/${examId}/resultados`);
  const [items, catalog] = await Promise.all([examItemsFor(loaded.exam), getCatalog()]);

  return (
    <ExamRunner
      examId={examId}
      title={examTitle(catalog, loaded.exam.scope)}
      items={items.map(toPublicItem)}
      initialAnswers={loaded.answers}
      endsAt={new Date(loaded.exam.startedAt).getTime() + loaded.exam.durationSeconds * 1000}
      demoMode={publicEnv.demoMode}
    />
  );
}
