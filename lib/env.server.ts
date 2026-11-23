import "server-only";
import { z } from "zod";

const ServerEnvSchema = z.object({
  supabaseSecretKey: z.string().optional(),
  demoEmail: z.email().optional(),
  demoPassword: z.string().min(8).optional(),
  googleApiKey: z.string().optional(),
  geminiModel: z.string().min(1),
  /** Modelo de imagen para las ilustraciones del widget (si no hay imagen verificada). */
  geminiImageModel: z.string().min(1),
  geminiThinkingLevel: z.enum(["MINIMAL", "LOW", "MEDIUM", "HIGH"]),
  tutorTimeoutMs: z.coerce.number().int().positive(),
  agentApiUrl: z.url().optional(),
  agentApiToken: z.string().optional(),
});

export const serverEnv = ServerEnvSchema.parse({
  supabaseSecretKey:
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
  demoEmail: process.env.DEMO_USER_EMAIL || undefined,
  demoPassword: process.env.DEMO_USER_PASSWORD || undefined,
  googleApiKey: process.env.GOOGLE_GENAI_API_KEY || undefined,
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash",
  geminiImageModel: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
  geminiThinkingLevel: (process.env.GEMINI_THINKING_LEVEL || "MINIMAL").toUpperCase(),
  tutorTimeoutMs: process.env.TUTOR_TIMEOUT_MS || 6000,
  agentApiUrl: process.env.AGENT_API_URL || undefined,
  agentApiToken: process.env.AGENT_API_TOKEN || undefined,
});
