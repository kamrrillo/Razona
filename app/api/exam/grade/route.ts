import { handleError, ok, parseJson, requireAuth } from "@/lib/api";
import { gradeExam } from "@/lib/data/exam";
import { ExamGradeRequestSchema, ExamGradeResponseSchema } from "@/lib/schemas/api";

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireAuth();
    const body = await parseJson(request, ExamGradeRequestSchema);
    const result = await gradeExam(supabase, userId, body.examId, body.fillDemo);
    return ok(ExamGradeResponseSchema, result);
  } catch (error) {
    return handleError(error);
  }
}
