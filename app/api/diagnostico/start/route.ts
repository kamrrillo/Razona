import { callDiagnosticAgent } from "@/lib/agent/client";
import { handleError, ok, parseJson, requireAuth } from "@/lib/api";
import { DiagnosticResponseSchema, DiagnosticStartRequestSchema } from "@/lib/schemas/diagnostic";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    await parseJson(request, DiagnosticStartRequestSchema);
    const data = await callDiagnosticAgent("/diagnostico/sesiones", { user_id: userId });
    return ok(DiagnosticResponseSchema, data);
  } catch (error) {
    return handleError(error);
  }
}
