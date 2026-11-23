import type { LearningWidget } from "@/lib/schemas/explanation";

/**
 * Documento HTML del widget generado. Se ejecuta en un iframe con `sandbox="allow-scripts"`
 * (origen opaco: sin acceso a cookies, almacenamiento ni a la página) y una CSP que bloquea
 * toda la red: imágenes solo como data: URL (la app ya las descargó y verificó).
 */

export const WIDGET_HEIGHT_MESSAGE = "rz-widget-height";

const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "font-src data:",
  "media-src data:",
  "form-action 'none'",
].join("; ");

const BASE_CSS = `:root{--rz-brand:#0b7d9a;--rz-brand-dark:#082c3b;--rz-brand-soft:#ecfbfd;--rz-aqua:#14b8a6;--rz-ok:#059669;--rz-bad:#e11d48;--rz-warn:#d97706;--rz-radius:14px;color-scheme:light}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;background:transparent}
body{font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f172a;-webkit-text-size-adjust:100%}
#rz-root{padding:2px}
button{font:inherit;cursor:pointer;touch-action:manipulation}
button:focus-visible{outline:3px solid var(--rz-aqua);outline-offset:2px}
img{max-width:100%;height:auto}
img[data-rz-imagen]{display:block;width:100%;max-height:300px;object-fit:contain;border-radius:var(--rz-radius);background:#f8fafc;margin:0 0 10px}`;

/** Evita que el contenido cierre antes de tiempo la etiqueta que lo contiene. */
const guard = (s: string, tag: "script" | "style") =>
  s.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);

export function buildWidgetDocument(w: Pick<LearningWidget, "html" | "css" | "js" | "image">) {
  const image = w.image ? { src: w.image.src, alt: w.image.alt } : null;
  // La imagen se coloca antes del JS del modelo: si el html no trae <img data-rz-imagen>,
  // se agrega arriba. Luego se reporta la altura al padre para ajustar el iframe.
  const boot = `(function(){var img=${guard(JSON.stringify(image), "script")};var root=document.getElementById("rz-root");
if(img&&root){var els=root.querySelectorAll("img[data-rz-imagen]");if(!els.length){var el=document.createElement("img");el.setAttribute("data-rz-imagen","");root.insertBefore(el,root.firstChild);els=[el];}
els.forEach(function(el){el.src=img.src;if(!el.alt)el.alt=img.alt;});}
var last=0;function report(){var h=Math.ceil(document.documentElement.scrollHeight);if(h!==last){last=h;parent.postMessage({type:"${WIDGET_HEIGHT_MESSAGE}",height:h},"*");}}
new ResizeObserver(report).observe(document.documentElement);window.addEventListener("load",report);report();
window.addEventListener("error",function(e){parent.postMessage({type:"rz-widget-error",message:String(e.message).slice(0,200)},"*");});})();`;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${BASE_CSS}</style>
<style>${guard(w.css, "style")}</style>
</head><body><div id="rz-root">${w.html}</div>
<script>${boot}</script>
<script>${guard(w.js, "script")}</script>
</body></html>`;
}
