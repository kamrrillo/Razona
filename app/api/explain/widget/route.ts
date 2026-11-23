import { widgetForLearner } from "@/lib/ai/widget";
import { handleError, ok, parseJson, requireAuth } from "@/lib/api";
import { loadExplainTarget } from "@/lib/data/explain-target";
import { ExplainRequestSchema, LearningWidgetSchema } from "@/lib/schemas/explanation";

/** Generar el widget y, si hace falta, su ilustración puede tardar. */
export const maxDuration = 60;

/**
 * Widget interactivo (HTML + CSS + JS) que complementa la explicación de un reactivo resuelto.
 * El cliente lo ejecuta en un iframe aislado (sandbox sin same-origin y CSP sin red).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await parseJson(request, ExplainRequestSchema);
    const { item, ctx } = await loadExplainTarget(auth, body);
    return ok(LearningWidgetSchema, await widgetForLearner(item, ctx));
  } catch (error) {
    return handleError(error);
  }
}
