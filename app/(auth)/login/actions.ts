"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth/next-path";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
  message?: string;
  /** Correo de una cuenta sin confirmar: el formulario ofrece reenviar la confirmación. */
  unconfirmedEmail?: string;
};

const MIN_PASSWORD = 8;
const Email = z.email("Escribe un correo válido, por ejemplo ana@correo.com");
const Password = z
  .string()
  .min(MIN_PASSWORD, `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`)
  .max(72, "La contraseña es demasiado larga");

const SignInSchema = z.object({
  email: Email,
  password: z.string().min(1, "Escribe tu contraseña"),
});

const SignUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe tu nombre (como quieres que te saludemos)")
    .max(60, "El nombre es demasiado largo"),
  email: Email,
  password: Password,
});

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos";
}

export async function signInWithPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = SignInSchema.safeParse({
    email: field(formData, "email").trim(),
    password: field(formData, "password"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error?.code === "email_not_confirmed") {
    return {
      error: `Tu cuenta aún no está confirmada. Abre el enlace que enviamos a ${parsed.data.email}.`,
      unconfirmedEmail: parsed.data.email,
    };
  }
  if (error) return { error: "Correo o contraseña incorrectos" };
  redirect(safeNextPath(formData.get("next")));
}

export async function signUpWithPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = SignUpSchema.safeParse({
    name: field(formData, "name"),
    email: field(formData, "email").trim(),
    password: field(formData, "password"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const next = safeNextPath(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // El trigger handle_new_user copia display_name a profiles (saludo en Inicio).
      data: { display_name: parsed.data.name },
      emailRedirectTo: await callbackUrl(next),
    },
  });
  if (error?.code === "user_already_exists") {
    return { error: "Ya hay una cuenta con ese correo. Entra o recupera tu contraseña." };
  }
  if (error?.code === "weak_password") {
    return { error: "Esa contraseña es muy fácil de adivinar. Prueba con otra más larga." };
  }
  if (error?.code === "over_email_send_rate_limit") {
    return { error: "Enviamos demasiados correos. Espera unos minutos e inténtalo de nuevo." };
  }
  if (error) return { error: "No se pudo crear la cuenta. Inténtalo de nuevo." };
  if (data.session) redirect(next === "/inicio" ? "/inicio?bienvenida=1" : next);
  return {
    message: `Te enviamos un correo a ${parsed.data.email}. Ábrelo para confirmar tu cuenta y entrar.`,
    unconfirmedEmail: parsed.data.email,
  };
}

/** Reenvía el correo de confirmación. Responde igual exista o no la cuenta. */
export async function resendConfirmation(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = Email.safeParse(field(formData, "email").trim());
  if (!email.success) return { error: firstIssue(email.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.data,
    options: { emailRedirectTo: await callbackUrl(safeNextPath(formData.get("next"))) },
  });
  if (error?.code === "over_email_send_rate_limit") {
    return { error: "Ya enviamos un correo hace poco. Espera unos minutos para pedir otro." };
  }
  return { message: `Si hay una cuenta pendiente con ${email.data}, te reenviamos el correo.` };
}

/** Envía el enlace para elegir una contraseña nueva. Responde igual exista o no la cuenta. */
export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = Email.safeParse(field(formData, "email").trim());
  if (!email.success) return { error: firstIssue(email.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: await callbackUrl("/restablecer"),
  });
  if (error?.code === "over_email_send_rate_limit") {
    return { error: "Ya enviamos un correo hace poco. Espera unos minutos para pedir otro." };
  }
  return {
    message: `Si ${email.data} tiene cuenta, te enviamos un enlace para elegir una contraseña nueva.`,
  };
}

/** Guarda la contraseña nueva (la sesión viene del enlace de recuperación). */
export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = Password.safeParse(field(formData, "password"));
  if (!password.success) return { error: firstIssue(password.error) };
  if (password.data !== field(formData, "confirm")) {
    return { error: "Las contraseñas no coinciden" };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error?.code === "same_password") {
    return { error: "Usa una contraseña distinta de la anterior." };
  }
  if (error?.code === "weak_password") {
    return { error: "Esa contraseña es muy fácil de adivinar. Prueba con otra más larga." };
  }
  if (error) return { error: "No se pudo guardar la contraseña. Pide un enlace nuevo." };
  redirect("/inicio?contrasena=1");
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

export async function signInWithGoogle(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!publicEnv.enableGoogle) return { error: "Google no está habilitado" };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await callbackUrl(safeNextPath(formData.get("next"))) },
  });
  if (error || !data.url) return { error: "No se pudo iniciar sesión con Google" };
  redirect(data.url);
}

async function callbackUrl(next: string): Promise<string> {
  const url = new URL("/auth/callback", await siteOrigin());
  if (next !== "/inicio") url.searchParams.set("next", next);
  return url.toString();
}

async function siteOrigin(): Promise<string> {
  if (publicEnv.siteUrl) return publicEnv.siteUrl.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
