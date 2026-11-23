import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/next-path";
import { requireSupabasePublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

const PROTECTED_PREFIXES = [
  "/inicio",
  "/practicar",
  "/examen",
  "/diagnostico",
  "/progreso",
  "/restablecer",
];

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
    // Recuerda a dónde iba para volver ahí después de entrar.
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const next = safeNextPath(`${pathname}${request.nextUrl.search}`, "");
    if (next && next !== "/inicio") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  if (pathname === "/" || (isAuthenticated && pathname === "/login")) {
    const url = request.nextUrl.clone();
    const next = isAuthenticated
      ? safeNextPath(request.nextUrl.searchParams.get("next"))
      : "/login";
    url.pathname = next.split("?")[0];
    url.search = next.includes("?") ? next.slice(next.indexOf("?")) : "";
    return NextResponse.redirect(url);
  }

  return response;
}
