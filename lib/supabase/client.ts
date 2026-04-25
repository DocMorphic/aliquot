import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let serverClient: SupabaseClient | null = null;

/**
 * Browser-safe client. Uses the public anon key. Read-only by RLS — never
 * grant writes via this client.
 */
export function getBrowserSupabase(): SupabaseClient {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase URL / anon key not set in environment.");
  }
  browserClient = createClient(url, key, {
    auth: { persistSession: false },
  });
  return browserClient;
}

/**
 * Server-only client using the service role key. Bypasses RLS — never
 * import this from a "use client" file.
 */
export function getServerSupabase(): SupabaseClient {
  if (serverClient) return serverClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase URL / service role key not set in environment.");
  }
  serverClient = createClient(url, key, {
    auth: { persistSession: false },
  });
  return serverClient;
}
