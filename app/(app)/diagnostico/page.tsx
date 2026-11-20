import type { Metadata } from "next";
import { DiagnosticSession } from "./diagnostic-session";

export const metadata: Metadata = { title: "Diagnóstico con IA" };

export default function DiagnosticoPage() {
  return <DiagnosticSession />;
}
