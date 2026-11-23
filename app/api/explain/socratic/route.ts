import { socraticReply } from "@/lib/ai/socratic";
import { handleError, ok, parseJson, requireAuth } from "@/lib/api";
import { loadExplainTarget } from "@/lib/data/explain-target";
import { SocraticReplySchema, SocraticRequestSchema } from "@/lib/schemas/explanation";

export const maxDuration = 30;

/**
 * Un turno del diálogo socrático posterior a la explicación. Sin estado en el servidor: el
 * cliente envía la conversación y el nivel; el reactivo se vuelve a validar en cada turno.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await parseJson(request, SocraticRequestSchema);
    const { item, ctx } = await loadExplainTarget(auth, body.target);
    return ok(
      SocraticReplySchema,
      await socraticReply(item, ctx, body.history, body.answer, body.level),
    );
  } catch (error) {
    return handleError(error);
  }
}
