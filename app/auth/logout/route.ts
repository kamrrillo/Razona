import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Cierra la sesión. Una participante del estudio vuelve a /estudio (para la siguiente persona),
 * salvo que el formulario pida ir al login (`to=login`, botón "Volver al inicio de sesión").
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const form = await request.formData().catch(() => null);
  await supabase.auth.signOut();
  const toLogin = form?.get("to") === "login";
  const to = data.user?.is_anonymous && !toLogin ? "/estudio" : "/login";
  return NextResponse.redirect(new URL(to, request.nextUrl.origin), { status: 303 });
}
