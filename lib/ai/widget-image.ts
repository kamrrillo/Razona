import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Item, Resource } from "@/lib/schemas/content";
import type { WidgetImage } from "@/lib/schemas/explanation";

/**
 * Imagen del widget. Siempre se descarga y verifica en el servidor y viaja como data: URL,
 * así el widget (iframe aislado) no necesita salir a la red. Orden de preferencia:
 *   1. "banco": imagen curada del banco de casos (json/assets, con autor y licencia).
 *   2. "buscar": Wikimedia Commons, solo archivos con licencia libre declarada.
 *   3. "generar": ilustración con el modelo de imagen de Gemini (se rotula como generada).
 */

const MAX_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 6000;
/** Wikimedia pide un User-Agent descriptivo para clientes automatizados. */
const USER_AGENT = "RazonaEdu/0.1 (plataforma educativa; imagenes de apoyo)";
const OK_MIME = /^image\/(jpeg|png|webp|gif)$/;
const FREE_LICENSE = /^(cc[ -]?by|cc[ -]?0|cc-zero|public domain|pd\b|pd-)/i;

type BancoImage = Extract<Resource, { type: "image" }>;

export function bankImage(item: Item): BancoImage | undefined {
  return item.resources?.find((r): r is BancoImage => r.type === "image");
}

const toDataUrl = (bytes: Uint8Array, mime: string) =>
  `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;

async function fromBank(item: Item, alt: string): Promise<WidgetImage | null> {
  const img = bankImage(item);
  if (!img) return null;
  const file = path.basename(img.imagePath);
  const ext = file.split(".").pop()?.toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const bytes = await readFile(path.join(process.cwd(), "json", "assets", file));
  if (bytes.byteLength > MAX_BYTES) return null;
  return {
    src: toDataUrl(bytes, mime),
    alt: alt || img.description,
    kind: "banco",
    credit: `${img.author} · ${img.license} · ${img.source}`,
    sourceUrl: img.sourceUrl,
  };
}

async function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

type CommonsPage = {
  title: string;
  index?: number;
  imageinfo?: {
    thumburl?: string;
    thumbmime?: string;
    mime?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string } | undefined>;
  }[];
};

const stripHtml = (s = "") =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Busca en Wikimedia Commons y devuelve la primera imagen con licencia libre que descargue bien. */
async function fromCommons(query: string, alt: string): Promise<WidgetImage | null> {
  const q = query.trim().slice(0, 120);
  if (!q) return null;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: `${q} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "6",
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: "800",
    origin: "*",
  });
  const res = await fetchWithTimeout(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } };
  const pages = Object.values(data.query?.pages ?? {}).sort(
    (a, b) => (a.index ?? 99) - (b.index ?? 99),
  );
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value);
    if (!info?.thumburl || !FREE_LICENSE.test(license)) continue;
    const img = await fetchWithTimeout(info.thumburl);
    const mime = img.headers.get("content-type")?.split(";")[0] ?? "";
    if (!img.ok || !OK_MIME.test(mime)) continue;
    const bytes = new Uint8Array(await img.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) continue;
    const author = stripHtml(meta.Artist?.value).slice(0, 120) || "Autor en Wikimedia Commons";
    return {
      src: toDataUrl(bytes, mime),
      alt: alt || stripHtml(meta.ImageDescription?.value).slice(0, 200) || page.title,
      kind: "commons",
      credit: `${author} · ${license} · Wikimedia Commons`,
      sourceUrl: info.descriptionurl,
    };
  }
  return null;
}

/** Ilustración didáctica con el modelo de imagen de Gemini. */
async function generate(
  prompt: string,
  alt: string,
  opts: { apiKey: string; imageModel: string },
): Promise<WidgetImage | null> {
  if (!prompt.trim()) return null;
  const { GoogleGenAI, Modality } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });
  const res = await ai.models.generateContent({
    model: opts.imageModel,
    contents: `Ilustración médica didáctica para estudiantes de medicina. ${prompt.trim()}
Estilo: esquema plano y limpio, fondo blanco, colores suaves (azul petróleo y aqua), sin texto, sin letras, sin rótulos, sin marcas de agua. No incluyas rostros identificables ni contenido sangriento.`,
    config: { responseModalities: [Modality.IMAGE] },
  });
  const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  const data = part?.inlineData?.data;
  const mime = part?.inlineData?.mimeType ?? "image/png";
  if (!data || !OK_MIME.test(mime)) return null;
  if (Buffer.byteLength(data, "base64") > MAX_BYTES * 2) return null;
  return {
    src: `data:${mime};base64,${data}`,
    alt: alt || "Ilustración del tema",
    kind: "generada",
    credit: "Ilustración generada con IA (Gemini) como apoyo visual; no sustituye a la GPC.",
  };
}

export type ImageRequest = {
  mode: "banco" | "buscar" | "generar" | "ninguna";
  query: string;
  prompt: string;
  alt: string;
};

/** Resuelve la imagen pedida por el modelo; cada paso que falla cae al siguiente. */
export async function resolveWidgetImage(
  item: Item,
  req: ImageRequest,
  gen: { apiKey: string; imageModel: string } | null,
): Promise<WidgetImage | null> {
  const attempt = async (fn: () => Promise<WidgetImage | null>, label: string) => {
    try {
      return await fn();
    } catch (error) {
      console.warn(`[widget] imagen ${label}:`, error instanceof Error ? error.message : error);
      return null;
    }
  };
  const img = await pickImage(item, req, gen, attempt);
  return img ? { ...img, alt: img.alt.slice(0, 200), credit: img.credit.slice(0, 300) } : null;
}

async function pickImage(
  item: Item,
  req: ImageRequest,
  gen: { apiKey: string; imageModel: string } | null,
  attempt: (fn: () => Promise<WidgetImage | null>, label: string) => Promise<WidgetImage | null>,
): Promise<WidgetImage | null> {
  if (req.mode === "ninguna") return null;
  if (req.mode === "banco") {
    const img = await attempt(() => fromBank(item, req.alt), "banco");
    if (img) return img;
  }
  if (req.mode === "buscar" || req.mode === "banco") {
    const img = await attempt(() => fromCommons(req.query, req.alt), "commons");
    if (img) return img;
  }
  if (gen && req.prompt) {
    return attempt(() => generate(req.prompt, req.alt, gen), "generada");
  }
  return null;
}

/** Imagen del banco para el widget de respaldo (sin red ni LLM). */
export async function bankWidgetImage(item: Item): Promise<WidgetImage | null> {
  try {
    return await fromBank(item, "");
  } catch {
    return null;
  }
}
