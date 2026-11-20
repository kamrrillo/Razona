import { handleError, ok, requireAuth } from "@/lib/api";
import { getProgress } from "@/lib/data/progress";
import { ProgressSchema } from "@/lib/schemas/api";

export async function GET() {
  try {
    const { supabase, userId } = await requireAuth();
    const progress = await getProgress(supabase, userId);
    return ok(ProgressSchema, progress, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleError(error);
  }
}
