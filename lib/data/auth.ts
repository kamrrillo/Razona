import "server-only";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";

export type AuthedContext = {
  supabase: ServerSupabase;
  userId: string;
  email: string | null;
  /** Participante del estudio que entró solo con su nombre (/estudio). */
  isAnonymous: boolean;
};

/** Devuelve la usuaria autenticada (verificada con el servidor de Auth) o null. */
export async function getAuthedContext(): Promise<AuthedContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return {
    supabase,
    userId: data.user.id,
    email: data.user.email ?? null,
    isAnonymous: Boolean(data.user.is_anonymous),
  };
}
