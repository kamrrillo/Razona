"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type EstudioState = { error?: string };

const NameSchema = z
  .string()
  .trim()
  .min(2, "Escribe tu nombre")
  .max(60, "El nombre es demasiado largo");

/** Paso 1: nueva participante con su nombre (sesión anónima, sin correo ni contraseña). */
export async function startParticipant(
  _prev: EstudioState,
  formData: FormData,
): Promise<EstudioState> {
  const raw = formData.get("name");
  const name = NameSchema.safeParse(typeof raw === "string" ? raw : "");
  if (!name.success) return { error: name.error.issues[0]?.message ?? "Escribe tu nombre" };
  if (formData.get("consent") !== "si") {
    return { error: "Para participar necesitas aceptar el acuerdo." };
  }

  const supabase = await createClient();
  // Si había otra sesión en este teléfono, se cierra: cada participante es una cuenta nueva.
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInAnonymously({
    // study_consent: el trigger guarda la fecha de aceptación en profiles.study_consent_at.
    options: { data: { display_name: name.data, study_consent: true } },
  });
  if (error?.code === "over_request_rate_limit") {
    return { error: "Demasiados registros desde esta red. Espera unos minutos." };
  }
  if (error) return { error: "No se pudo registrar tu nombre. Inténtalo de nuevo." };
  redirect("/estudio");
}

/** Paso 2: elige el modo. Queda fijo: la base solo acepta la primera elección. */
export async function chooseMode(formData: FormData): Promise<void> {
  const mode = formData.get("mode");
  if (mode !== "ia" && mode !== "control") redirect("/estudio");
  const supabase = await createClient();
  const { error } = await supabase.rpc("elegir_grupo_estudio", { grupo: mode });
  if (error) redirect("/estudio?error=1");
  redirect("/practicar");
}
