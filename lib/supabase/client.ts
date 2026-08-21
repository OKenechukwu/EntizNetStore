// NOTE: intentionally NOT marked "use client" — this module is imported by
// both client components and API route handlers. A "use client" directive
// turns its exports into client-reference proxies inside route handlers,
// which crashes the production build at page-data collection.
// It contains no client-only code (window/localStorage access is guarded).
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient, Session } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/** Singleton browser-compatible Supabase client. */
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
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      // PKCE code flow: consistent with exchangeCodeForSession() in
      // /auth/callback and with password-recovery links. detectSessionInUrl
      // auto-exchanges ?code= on any page for this client.
      flowType: "pkce",
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
