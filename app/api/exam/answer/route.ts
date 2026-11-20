import { handleError, ok, parseJson, requireAuth } from "@/lib/api";
import { answerExam } from "@/lib/data/exam";
import { ExamAnswerRequestSchema, ExamAnswerResponseSchema } from "@/lib/schemas/api";

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireAuth();
    const body = await parseJson(request, ExamAnswerRequestSchema);
    const answered = await answerExam(supabase, userId, body.examId, body.itemId, body.optionId);
    return ok(ExamAnswerResponseSchema, { ok: true, answered });
  } catch (error) {
    return handleError(error);
  }
}
