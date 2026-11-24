import { callDiagnosticAgent } from "@/lib/agent/client";
import { handleError, ok, parseJson, requireAiAuth } from "@/lib/api";
import { DiagnosticAnswerRequestSchema, DiagnosticResponseSchema } from "@/lib/schemas/diagnostic";

export async function POST(request: Request) {
  try {
    const { userId } = await requireAiAuth();
    const body = await parseJson(request, DiagnosticAnswerRequestSchema);
    const data = await callDiagnosticAgent(
      `/diagnostico/sesiones/${encodeURIComponent(body.sessionId)}/respuestas`,
      { user_id: userId, item_id: body.itemId, opcion: body.optionId },
    );
    return ok(DiagnosticResponseSchema, data);
  } catch (error) {
    return handleError(error);
  }
}
