import { handleError, ok, parseJson, requireAuth } from "@/lib/api";
import { startExam } from "@/lib/data/exam";
import { ExamStartRequestSchema, ExamStartResponseSchema } from "@/lib/schemas/api";

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireAuth();
    const body = await parseJson(request, ExamStartRequestSchema);
    const scope =
      body.scope === "global" || !body.ref
        ? ({ kind: "global" } as const)
        : { kind: body.scope, ref: body.ref };
    const examId = await startExam(supabase, userId, scope);
    return ok(ExamStartResponseSchema, { examId });
  } catch (error) {
    return handleError(error);
  }
}
