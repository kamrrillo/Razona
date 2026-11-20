import "server-only";
import { z } from "zod";

const ServerEnvSchema = z.object({
  supabaseSecretKey: z.string().optional(),
  demoEmail: z.email().optional(),
  demoPassword: z.string().min(8).optional(),
  googleApiKey: z.string().optional(),
  geminiModel: z.string().min(1),
  tutorTimeoutMs: z.coerce.number().int().positive(),
});

export const serverEnv = ServerEnvSchema.parse({
  supabaseSecretKey:
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
  demoEmail: process.env.DEMO_USER_EMAIL || undefined,
  demoPassword: process.env.DEMO_USER_PASSWORD || undefined,
  googleApiKey: process.env.GOOGLE_GENAI_API_KEY || undefined,
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  tutorTimeoutMs: process.env.TUTOR_TIMEOUT_MS || 6000,
});
