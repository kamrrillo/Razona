import { z } from "zod";

/**
 * Variables públicas. Se referencian de forma literal para que Next las incruste en el cliente.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
  enableGoogle: process.env.NEXT_PUBLIC_ENABLE_GOOGLE === "true",
  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "",
  posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
} as const;

const SupabasePublicSchema = z.object({
  supabaseUrl: z.url(),
  supabaseKey: z.string().min(1),
});

export function requireSupabasePublicEnv() {
  const parsed = SupabasePublicSchema.safeParse(publicEnv);
  if (!parsed.success) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (o _ANON_KEY). Revisa .env.example.",
    );
  }
  return parsed.data;
}
