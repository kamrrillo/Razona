import "server-only";
import { HttpError } from "@/lib/api";
import { serverEnv } from "@/lib/env.server";
import { type DiagnosticResponse, DiagnosticResponseSchema } from "@/lib/schemas/diagnostic";

const TIMEOUT_MS = 60_000;

export const AGENT_UNAVAILABLE =
  "El agente de diagnóstico no está disponible. Inicia el servidor del agente (agent/) e intenta de nuevo.";

/** Llama al servidor FastAPI del agente (solo servidor; el token nunca llega al cliente). */
export async function callDiagnosticAgent(
  path: string,
  body: Record<string, unknown>,
): Promise<DiagnosticResponse> {
  if (!serverEnv.agentApiUrl) throw new HttpError(503, AGENT_UNAVAILABLE);

  let res: Response;
  try {
    res = await fetch(new URL(path, serverEnv.agentApiUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(serverEnv.agentApiToken ? { Authorization: `Bearer ${serverEnv.agentApiToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new HttpError(503, AGENT_UNAVAILABLE);
  }

  if (!res.ok) {
    const detail = await res
      .json()
      .then((j: { detail?: unknown }) => (typeof j.detail === "string" ? j.detail : null))
      .catch(() => null);
    if (res.status === 400 || res.status === 404) {
      throw new HttpError(res.status, detail ?? "Solicitud inválida");
    }
    console.error("[agent]", res.status, detail);
    throw new HttpError(503, AGENT_UNAVAILABLE);
  }

  const parsed = DiagnosticResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    console.error("[agent] respuesta inválida", parsed.error.issues.slice(0, 3));
    throw new HttpError(502, "Respuesta inesperada del agente");
  }
  return parsed.data;
}
