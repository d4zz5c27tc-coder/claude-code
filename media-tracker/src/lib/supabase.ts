import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { readSupabaseSecretKey, requireEnv } from "./env";

/**
 * Serverseitiger Supabase-Client mit dem Secret-Key.
 *
 * WICHTIG: Dieser Key umgeht Row Level Security und darf niemals in den
 * Browser gelangen. Deshalb "server-only" oben – ein versehentlicher Import
 * in einer Client-Komponente bricht den Build ab.
 */
let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    const key = readSupabaseSecretKey();
    if (!key) {
      throw new Error("Umgebungsvariable SUPABASE_SECRET_KEY fehlt – siehe README.");
    }
    client = createClient<Database>(requireEnv("SUPABASE_URL"), key, {
      // Wir nutzen Supabase nur als Datenbank, nicht für Logins
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
