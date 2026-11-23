"use client";

import { ExternalLink, Loader2, MousePointerClick, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LearningWidgetSchema, type LearningWidget as Widget } from "@/lib/schemas/explanation";
import { buildWidgetDocument, WIDGET_HEIGHT_MESSAGE } from "@/lib/widget-doc";

const MIN_HEIGHT = 160;
const MAX_HEIGHT = 1400;

/** Widget generado, ejecutado en un iframe aislado que ajusta su altura a su contenido. */
export function LearningWidgetView({ widget }: { widget: Widget }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(320);
  const [version, setVersion] = useState(0);
  const doc = useMemo(() => buildWidgetDocument(widget), [widget]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== frame.current?.contentWindow) return;
      const data = e.data as { type?: string; height?: number; message?: string };
      if (data?.type === WIDGET_HEIGHT_MESSAGE && typeof data.height === "number") {
        setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, data.height + 4)));
      } else if (data?.type === "rz-widget-error") {
        console.warn("[widget]", data.message);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <section
      className="space-y-2 rounded-2xl bg-brand-50/70 p-3 ring-1 ring-brand-100"
      data-testid="learning-widget"
      data-source={widget.source}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-aqua-600">
            {widget.approach}
          </p>
          <h3 className="text-sm font-extrabold text-brand-900">{widget.title}</h3>
          {widget.intro && <p className="text-sm text-brand-800/80">{widget.intro}</p>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setVersion((v) => v + 1)}
          aria-label="Reiniciar el widget"
          title="Reiniciar"
        >
          <RotateCcw aria-hidden />
        </Button>
      </header>
      <iframe
        key={version}
        ref={frame}
        title={widget.title}
        srcDoc={doc}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        loading="lazy"
        className="block w-full rounded-xl border-0 bg-white"
        style={{ height }}
      />
      {widget.image && (
        <p className="text-[11px] leading-snug text-muted-foreground" data-testid="widget-credit">
          {widget.image.kind === "generada" ? "🖌️ " : "📷 "}
          {widget.image.credit}
          {widget.image.sourceUrl && (
            <>
              {" · "}
              <a
                href={widget.image.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline"
              >
                fuente <ExternalLink className="size-3" aria-hidden />
              </a>
            </>
          )}
        </p>
      )}
    </section>
  );
}

export type WidgetState =
  | { status: "idle" | "loading" | "error"; widget: null }
  | { status: "ready"; widget: Widget };

/**
 * Pide el widget a /api/explain/widget en cuanto `enabled` (en paralelo a la explicación).
 * Un solo pedido por reactivo, también con el doble montaje de StrictMode: generarlo es caro,
 * así que no se cancela; si cambia el reactivo, se ignora la respuesta vieja.
 */
export function useLearningWidget(body: string, enabled: boolean): WidgetState {
  const [state, setState] = useState<WidgetState>({ status: "idle", widget: null });
  const requested = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || requested.current === body) return;
    requested.current = body;
    setState({ status: "loading", widget: null });
    void (async () => {
      try {
        const res = await fetch("/api/explain/widget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (!res.ok) throw new Error(String(res.status));
        const widget = LearningWidgetSchema.parse(await res.json());
        if (requested.current === body) setState({ status: "ready", widget });
      } catch {
        if (requested.current === body) setState({ status: "error", widget: null });
      }
    })();
  }, [body, enabled]);

  return state;
}

/** Lugar del widget dentro de la explicación: cargando, listo o nada si falló. */
export function LearningWidgetSlot({ state }: { state: WidgetState }) {
  if (state.status === "ready") return <LearningWidgetView widget={state.widget} />;
  if (state.status !== "loading") return null;
  return (
    <div
      className="flex min-h-20 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-aqua-200 bg-[#effcf9] px-4 text-center text-sm text-brand-700"
      data-testid="widget-loading"
    >
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      <MousePointerClick className="size-4 shrink-0" aria-hidden />
      Preparando una actividad interactiva para que lo practiques…
    </div>
  );
}
