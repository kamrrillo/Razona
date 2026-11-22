import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Imágenes de los recursos de aprendizaje. La fuente es json/assets (el banco de casos),
 * así que no se copian a public/. next.config.ts incluye esa carpeta en el build.
 */
const ARCHIVO = /^RZ-[A-Z]{3}-\d{3}-(?:I|V\d+)-R\d+\.(jpg|jpeg|png|webp)$/;
const TIPOS: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(_request: Request, ctx: RouteContext<"/recursos/[archivo]">) {
  const { archivo } = await ctx.params;
  const match = ARCHIVO.exec(archivo);
  if (!match) return new Response("No encontrado", { status: 404 });
  try {
    const bytes = await readFile(path.join(process.cwd(), "json", "assets", archivo));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": TIPOS[match[1]],
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
