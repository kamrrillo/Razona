import { explainForLearner } from "@/lib/ai/explain";
import { handleError, ok, parseJson, requireAiAuth } from "@/lib/api";
import { loadExplainTarget } from "@/lib/data/explain-target";
import { ExplainRequestSchema, TutorExplanationSchema } from "@/lib/schemas/explanation";

export const maxDuration = 30;

/**
 * Explicación personalizada de un reactivo resuelto: primero lo que dice la GPC (citada), luego
 * el porqué, fundamentos, diagrama conceptual y una pregunta socrática de cierre.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAiAuth();
    const body = await parseJson(request, ExplainRequestSchema);
    const { item, ctx } = await loadExplainTarget(auth, body);
    return ok(TutorExplanationSchema, await explainForLearner(item, ctx));
  } catch (error) {
    return handleError(error);
  }
}
