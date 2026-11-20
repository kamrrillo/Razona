/**
 * Eventos de PostHog del guion de la demo. Si no hay NEXT_PUBLIC_POSTHOG_KEY, no hace nada.
 * Se usa la API HTTP de captura directamente para no agregar dependencias.
 */
export type DemoEvent =
  | "login_demo"
  | "case_started"
  | "hint_shown"
  | "case_completed"
  | "exam_started"
  | "exam_finished"
  | "practice_weak_topic";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com").replace(
  /\/$/,
  "",
);
const ID_STORAGE_KEY = "razona_distinct_id";

function distinctId(): string {
  try {
    const existing = window.localStorage.getItem(ID_STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(ID_STORAGE_KEY, id);
    return id;
  } catch {
    return "anonymous";
  }
}

export function isAnalyticsEnabled(): boolean {
  return KEY.length > 0;
}

export function track(event: DemoEvent, properties: Record<string, unknown> = {}): void {
  if (!KEY || typeof window === "undefined") return;
  try {
    void fetch(`${HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        api_key: KEY,
        event,
        distinct_id: distinctId(),
        properties: { ...properties, $current_url: window.location.href, app: "razona-demo" },
      }),
    }).catch(() => undefined);
  } catch {
    // La analítica nunca debe romper la demo.
  }
}
