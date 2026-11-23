import "server-only";
import { specialtyName } from "@/lib/content";
import { serverEnv } from "@/lib/env.server";
import type { Item } from "@/lib/schemas/content";
import {
  type LearningWidget,
  LearningWidgetSchema,
  ModelWidgetSchema,
} from "@/lib/schemas/explanation";
import { runStructuredAgent, withTimeout } from "./adk-structured";
import { geminiOptions } from "./explain";
import { gpcFragments, type LearnerContext } from "./feedback";
import { bankImage, bankWidgetImage, resolveWidgetImage } from "./widget-image";

const WIDGET_TIMEOUT_MS = 35000;

export const WIDGET_INSTRUCTION = `Eres diseñadora instruccional y desarrolladora front-end de Razona (preparación para el ENARM, México). La estudiante ya leyó la explicación de un reactivo resuelto. Tu trabajo: crear UN widget interactivo que COMPLEMENTE esa explicación (no la repita) y la haga aprender haciendo.

1. Elige tú el formato que mejor enseñe ESTE tema y nómbralo en approach (2 a 4 palabras, p. ej. "Simulador de triaje"). Ideas (no te limites a ellas):
   - Simulador con deslizador o botones: cambia un valor (edad, fiebre, SatO₂, días de evolución…) y ve cómo cambia la clasificación o la conducta según la GPC.
   - Clasificador: tarjetas con hallazgos que la estudiante asigna a la categoría correcta y recibe retroalimentación inmediata.
   - Decisión ramificada: un mini caso nuevo con 2 o 3 decisiones; cada elección muestra la consecuencia y la cita de la GPC.
   - Línea de tiempo o secuencia: ordenar pasos o fases tocando en orden.
   - Comparador lado a lado con revelado progresivo (la correcta frente a lo que eligió ella).
   - Imagen con zonas o hallazgos señalados que se revelan al tocar.
2. Adáptalo a su resultado:
   - Si SE EQUIVOCÓ: el widget la ayuda a CORREGIR. Contrasta su opción con la correcta y hazla redescubrir, interactuando, el dato o criterio que pasó por alto (p. ej. mueve el valor y ve dónde cambia la conducta; clasifica hallazgos y descubre cuál decide).
   - Si ACERTÓ: el widget REFUERZA y sube un escalón: variantes del caso con un dato distinto, excepciones o límites del criterio que usó bien.
   Progresión: que empiece fácil y suba un poco de dificultad; al final muestra un breve resumen de lo que logró.
3. Imagen: decide si una imagen ayuda de verdad (signos clínicos visibles, anatomía, estudios de imagen, lesiones de piel…).
   - "banco": usa la imagen curada del banco si te la doy y es pertinente.
   - "buscar": imagen real de Wikimedia Commons; en query pon 2 a 5 términos en inglés muy específicos (p. ej. "Koplik spots measles"). La app verifica licencia y descarga.
   - "generar": ilustración esquemática generada por IA; describe en prompt qué dibujar (sin texto ni rótulos).
   - "ninguna": si no aporta.
   En "buscar" llena también prompt como respaldo. Si usas imagen, pon EXACTAMENTE un <img data-rz-imagen alt="…"> en el html donde ayude (la app pone el src; no escribas src). alt describe la imagen en español.

Reglas técnicas (se ejecuta en un iframe aislado, sin red):
- html: solo el contenido que va dentro de <div id="rz-root">. Sin <html>, <head>, <body>, <script>, <link>, <iframe> ni <form>.
- css: CSS moderno; puedes usar anidamiento nativo estilo SCSS (& y reglas anidadas) y estas variables ya definidas: --rz-brand (#0b7d9a), --rz-brand-dark (#082c3b), --rz-brand-soft (#ecfbfd), --rz-aqua (#14b8a6), --rz-ok (#059669), --rz-bad (#e11d48), --rz-warn (#d97706), --rz-radius (14px). Prefija todas las clases con rz-. Móvil primero (320 a 440 px de ancho), objetivos táctiles de 44 px o más, sin anchos fijos mayores a 100 %.
- js: JavaScript vanilla moderno, envuelto en una función autoejecutable. Sin librerías, sin fetch/XMLHttpRequest/WebSocket, sin localStorage, sin alert/confirm/prompt, sin eval. Busca elementos dentro de document.getElementById("rz-root") y no falles si alguno no existe. Usa <button> reales, aria-live="polite" para la retroalimentación y textos en español de México hablándole de tú.
- Tamaño: html y js de máximo ~9000 caracteres cada uno; css de máximo ~6000.

Reglas de contenido:
- Cifras, puntos de corte, dosis y recomendaciones salen ÚNICAMENTE de la viñeta, la explicación, los puntos clave y los fragmentos de la GPC que te doy. Cuando muestres una de ellas, rotula la fuente de forma breve (p. ej. "GPC IMSS-027-08, p. 14").
- No cites otras guías, sociedades ni estudios. No pongas enlaces externos.
- title: título corto del widget. intro: 1 oración que le diga qué hacer.`;

export function buildWidgetPrompt(item: Item, ctx: LearnerContext): string {
  const options = item.options.map((o) => `${o.id}) ${o.text}`).join("\n");
  const correct = item.options.find((o) => o.id === item.correctOptionId);
  const chosen = ctx.wrongChoices
    .map((id) => `${id}) ${item.options.find((o) => o.id === id)?.text ?? ""}`)
    .join("; ");
  const keyPoints = (item.keyPoints ?? []).map((k) => `- ${k.text}`).join("\n");
  const img = bankImage(item);
  return `Tema: ${specialtyName(item)} · ${item.topic}

Viñeta:
${item.vignette}

Pregunta: ${item.question}
${options}
Respuesta correcta: ${item.correctOptionId}) ${correct?.text ?? ""}
${ctx.answeredCorrectly ? `Resultado: ACERTÓ.${chosen ? ` Antes había elegido (incorrecto): ${chosen}` : ""} Objetivo del widget: REFORZAR y llevarla un paso más allá.` : `Resultado: SE EQUIVOCÓ. Eligió: ${chosen || "nada"}. Objetivo del widget: CORREGIR esa idea.`}

Explicación: ${item.explanation}
${keyPoints ? `Puntos clave:\n${keyPoints}\n` : ""}
GPC: ${item.citation.gpcTitle} (clave ${item.citation.gpcId})
Fragmentos de la GPC:
${gpcFragments(item, 5)}

Historial en el tema: ${ctx.topic.correct} de ${ctx.topic.total} aciertos${ctx.topic.isWeakest ? " (su tema más débil)" : ""}.
${img ? `Imagen del banco disponible ("banco"): ${img.description}` : "No hay imagen en el banco para este caso."}`;
}

const cut = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

/** Recorta en el último espacio antes del límite (para etiquetas visibles), con «…». */
function words(s: string, max: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const head = clean.slice(0, max - 1);
  const space = head.lastIndexOf(" ");
  return `${(space > max / 2 ? head.slice(0, space) : head).replace(/[\s/,;:·-]+$/, "")}…`;
}

/** Quita lo que no debe ir en el html (el iframe ya está aislado; esto evita roturas). */
function cleanHtml(html: string): string {
  return html
    .replace(/<\/?(html|head|body|script|link|iframe|form|meta|base)\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, "");
}

async function generateWithAdk(item: Item, ctx: LearnerContext): Promise<LearningWidget> {
  const gemini = geminiOptions();
  if (!gemini) throw new Error("sin clave");
  const raw = await runStructuredAgent({
    appName: "razona-widgets",
    name: "disenadora_widget",
    description: "Crea un widget interactivo HTML/CSS/JS que complementa la explicación.",
    instruction: WIDGET_INSTRUCTION,
    schema: ModelWidgetSchema,
    prompt: buildWidgetPrompt(item, ctx),
    gemini,
    temperature: 0.7,
    maxOutputTokens: 9000,
  });
  const html = cleanHtml(raw.html).trim();
  if (html.length < 40 || raw.js.length > 16000 || raw.html.length > 16000) {
    throw new Error("widget vacío o demasiado grande");
  }
  const image = await resolveWidgetImage(item, raw.image, {
    apiKey: gemini.apiKey,
    imageModel: serverEnv.geminiImageModel,
  });
  return LearningWidgetSchema.parse({
    approach: words(raw.approach || "Interactivo", 40),
    title: words(raw.title || item.topic, 90),
    intro: words(raw.intro, 240),
    html,
    css: cut(raw.css, 12000),
    js: raw.js,
    image,
    source: "adk",
  });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Widget de respaldo sin LLM: autoevaluación de los puntos clave con revelado de la cita de la
 * GPC (contenido del banco, revisado por humanos) y la imagen curada si existe.
 */
export async function buildFallbackWidget(item: Item): Promise<LearningWidget> {
  const points = (
    item.keyPoints?.length ? item.keyPoints : [{ text: item.explanation, citation: item.citation }]
  ).slice(0, 4);
  const image = await bankWidgetImage(item);
  const cards = points
    .map(
      (p, i) => `<li class="rz-card">
  <p class="rz-q"><span class="rz-n">${i + 1}</span> ¿Qué dice la GPC sobre esto? <em>${esc(p.citation.section)}</em></p>
  <button type="button" class="rz-reveal" aria-expanded="false">Mostrar</button>
  <div class="rz-a" hidden>
    <p>${esc(p.text)}</p>
    <p class="rz-cite">«${esc(p.citation.snippet)}» — GPC ${esc(p.citation.gpcId)}${p.citation.page ? `, p. ${p.citation.page}` : ""}</p>
    <div class="rz-self"><span>¿Lo sabías?</span><button type="button" data-ok="1">Sí</button><button type="button" data-ok="0">Aún no</button></div>
  </div>
</li>`,
    )
    .join("\n");
  return {
    approach: "Autoevaluación",
    title: `Repasa ${item.topic} con la GPC`,
    intro: "Intenta recordar cada punto antes de revelarlo y marca si ya lo sabías.",
    html: `${image ? '<img data-rz-imagen alt="">' : ""}
<ol class="rz-list">${cards}</ol>
<p class="rz-score" aria-live="polite"></p>`,
    css: `.rz-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.rz-card{background:#fff;border-radius:var(--rz-radius);padding:12px;box-shadow:0 0 0 1px #cff4f9;
  & .rz-q{margin:0 0 8px;font-weight:700;color:var(--rz-brand-dark)}
  & em{display:block;font-weight:400;font-style:normal;font-size:12px;color:#64748b}
  & .rz-a p{margin:6px 0}
}
.rz-n{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--rz-brand);color:#fff;font-size:12px;margin-right:4px}
.rz-reveal,.rz-self button{min-height:44px;padding:0 16px;border-radius:999px;border:0;background:var(--rz-brand-soft);color:var(--rz-brand);font-weight:700}
.rz-cite{font-size:13px;color:#475569;border-left:3px solid var(--rz-aqua);padding-left:8px}
.rz-self{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px}
.rz-score{font-weight:700;color:var(--rz-ok)}`,
    js: `(function(){var root=document.getElementById("rz-root");if(!root)return;var done={},score=root.querySelector(".rz-score");
root.querySelectorAll(".rz-card").forEach(function(card,i){var b=card.querySelector(".rz-reveal"),a=card.querySelector(".rz-a");
b&&b.addEventListener("click",function(){a.hidden=!a.hidden;b.setAttribute("aria-expanded",String(!a.hidden));b.textContent=a.hidden?"Mostrar":"Ocultar";});
card.querySelectorAll("[data-ok]").forEach(function(btn){btn.addEventListener("click",function(){done[i]=btn.dataset.ok==="1";
card.querySelectorAll("[data-ok]").forEach(function(x){x.style.outline=x===btn?"2px solid var(--rz-brand)":"none";});
var total=root.querySelectorAll(".rz-card").length,n=Object.keys(done).length,ok=Object.values(done).filter(Boolean).length;
if(score)score.textContent=n===total?(ok===total?"¡Dominas los "+total+" puntos!":"Ya sabías "+ok+" de "+total+". Repasa los que marcaste como «Aún no».") : "";});});});})();`,
    image,
    source: "fallback",
  };
}

/** Widget complementario con ADK si hay clave; si falla o tarda, el de respaldo. */
export async function widgetForLearner(item: Item, ctx: LearnerContext): Promise<LearningWidget> {
  if (!geminiOptions()) return buildFallbackWidget(item);
  try {
    return await withTimeout(generateWithAdk(item, ctx), WIDGET_TIMEOUT_MS);
  } catch (error) {
    console.warn("[widget] usando respaldo:", error instanceof Error ? error.message : error);
    return buildFallbackWidget(item);
  }
}
