/** Rutas de la app a las que se puede volver después de entrar. */
const APP_PREFIXES = [
  "/inicio",
  "/practicar",
  "/examen",
  "/diagnostico",
  "/progreso",
  "/restablecer",
];

/**
 * Destino seguro después de entrar: solo rutas internas de la app (nada de `//otro.sitio`,
 * esquemas ni rutas de auth). Cualquier otra cosa vuelve a /inicio.
 */
export function safeNextPath(next: unknown, fallback = "/inicio"): string {
  if (typeof next !== "string" || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  let url: URL;
  try {
    url = new URL(next, "http://razona.local");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://razona.local") return fallback;
  const ok = APP_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`));
  return ok ? `${url.pathname}${url.search}` : fallback;
}
