import { handleError, ok, parseJson, requireAuth } from "@/lib/api";
import { startExam } from "@/lib/data/exam";
import { ExamStartRequestSchema, ExamStartResponseSchema } from "@/lib/schemas/api";

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireAuth();
    await parseJson(request, ExamStartRequestSchema);
    const examId = await startExam(supabase, userId);
    return ok(ExamStartResponseSchema, { examId });
  } catch (error) {
    return handleError(error);
  }
}
