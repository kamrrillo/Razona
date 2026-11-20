import type { Metadata } from "next";
import { PracticeSession } from "./practice-session";

export const metadata: Metadata = { title: "Practicar" };

export default async function PracticarPage({ searchParams }: PageProps<"/practicar">) {
  const params = await searchParams;
  const topic = typeof params.topic === "string" ? params.topic : undefined;
  // `key` reinicia la sesión cuando cambia el tema solicitado.
  return <PracticeSession key={topic ?? "auto"} topic={topic} />;
}
