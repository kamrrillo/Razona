import { callDiagnosticAgent } from "@/lib/agent/client";
import { handleError, ok, parseJson, requireAuth } from "@/lib/api";
import { DiagnosticGradeRequestSchema, DiagnosticResponseSchema } from "@/lib/schemas/diagnostic";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth();
    const body = await parseJson(request, DiagnosticGradeRequestSchema);
    const data = await callDiagnosticAgent(
      `/diagnostico/sesiones/${encodeURIComponent(body.sessionId)}/calificar`,
      { user_id: userId },
    );
    return ok(DiagnosticResponseSchema, data);
  } catch (error) {
    return handleError(error);
  }
}
