import { handleError, ok, parseJson, requireAuth } from "@/lib/api";
import { chooseCase, createStudySession, toPublicItem } from "@/lib/data/practice";
import { SessionRequestSchema, SessionResponseSchema } from "@/lib/schemas/api";

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireAuth();
    const body = await parseJson(request, SessionRequestSchema);
    const { item, reason } = await chooseCase(supabase, userId, body);
    const sessionId = await createStudySession(supabase, userId, item.id);
    return ok(SessionResponseSchema, {
      sessionId,
      item: toPublicItem(item),
      reason,
      messages: [],
    });
  } catch (error) {
    return handleError(error);
  }
}
