"use client";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient, Session } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/** Singleton plain browser client (more reliable on Replit preview). */
export function getSupabaseClient() {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  _client = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "entiznet.auth",
      // Force browser storage (fixes some iframe/preview oddities)
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      flowType: "implicit", // best for email+password / magic links in SPA
    },
  });

  return _client;
}

export const supabase = getSupabaseClient();

/** Wait for session after sign-in (helps right after token write). */
export async function waitForSession(
  timeoutMs = 6000,
  pollMs = 150,
): Promise<Session | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return null;
}
