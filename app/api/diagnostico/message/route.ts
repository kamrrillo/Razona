import { callDiagnosticAgent } from "@/lib/agent/client";
import { handleError, ok, parseJson, requireAiAuth } from "@/lib/api";
import { DiagnosticMessageRequestSchema, DiagnosticResponseSchema } from "@/lib/schemas/diagnostic";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { userId } = await requireAiAuth();
    const body = await parseJson(request, DiagnosticMessageRequestSchema);
    const data = await callDiagnosticAgent(
      `/diagnostico/sesiones/${encodeURIComponent(body.sessionId)}/mensajes`,
      { user_id: userId, texto: body.text },
    );
    return ok(DiagnosticResponseSchema, data);
  } catch (error) {
    return handleError(error);
  }
}
