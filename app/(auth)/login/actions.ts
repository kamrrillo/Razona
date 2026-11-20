"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; message?: string };

const CredentialsSchema = z.object({
  email: z.email("Correo no válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function signInWithPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Correo o contraseña incorrectos" };
  redirect("/inicio");
}

export async function signUpWithPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: "No se pudo crear la cuenta" };
  if (data.session) redirect("/inicio");
  return { message: "Revisa tu correo para confirmar tu cuenta." };
}

/** Entra como Ana. La contraseña vive solo en el servidor (DEMO_USER_PASSWORD). */
export async function signInAsDemo(): Promise<AuthFormState> {
  if (!publicEnv.demoMode || !serverEnv.demoEmail || !serverEnv.demoPassword) {
    return { error: "El modo demo no está disponible" };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: serverEnv.demoEmail,
    password: serverEnv.demoPassword,
  });
  if (error) return { error: "No se pudo entrar como Ana. ¿Corriste pnpm seed:demo?" };
  redirect("/inicio?demo=1");
}

export async function signInWithGoogle(): Promise<AuthFormState> {
  if (!publicEnv.enableGoogle) return { error: "Google no está habilitado" };
  const supabase = await createClient();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) return { error: "No se pudo iniciar sesión con Google" };
  redirect(data.url);
}

async function siteOrigin(): Promise<string> {
  if (publicEnv.siteUrl) return publicEnv.siteUrl.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
