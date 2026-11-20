import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { requireSupabasePublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

const PROTECTED_PREFIXES = ["/inicio", "/practicar", "/examen", "/diagnostico", "/progreso"];

/** Refresca la sesión de Supabase y protege las rutas de (app). */
export async function updateSession(request: NextRequest) {
  const { supabaseUrl, supabaseKey } = requireSupabasePublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Importante: no ejecutar código entre createServerClient y getClaims().
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isAuthenticated && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname === "/" || (isAuthenticated && pathname === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = isAuthenticated ? "/inicio" : "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
