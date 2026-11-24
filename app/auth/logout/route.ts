import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  // Una participante del estudio vuelve a la entrada del estudio (para la siguiente persona).
  const to = data.user?.is_anonymous ? "/estudio" : "/login";
  return NextResponse.redirect(new URL(to, request.nextUrl.origin), { status: 303 });
}
