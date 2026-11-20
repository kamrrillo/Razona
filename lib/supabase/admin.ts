import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireSupabasePublicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "./database.types";

/** Cliente con service role. SOLO servidor; omite RLS. */
export function createAdminClient() {
  const { supabaseUrl } = requireSupabasePublicEnv();
  if (!serverEnv.supabaseSecretKey) {
    throw new Error("Falta SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createClient<Database>(supabaseUrl, serverEnv.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
