// Browser Supabase client for Next.js SSR auth.
//
// @supabase/ssr stores the browser session in cookies so the same authenticated
// identity is available to Client Components and trusted Route Handlers. Do not
// replace this with a localStorage-only supabase-js client: doing so splits the
// client/server session and causes authenticated server APIs to fail closed.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, Session } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function publicSupabaseKey(): string {
  // Supabase publishable keys are the preferred browser credential. The legacy
  // anon fallback remains during rollout so Preview/Production can be migrated
  // independently without breaking sessions.
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY is required",
    );
  }
  return key;
}

/** Singleton browser-compatible Supabase client backed by SSR auth cookies. */
export function getSupabaseClient() {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");

  _client = createBrowserClient(url, publicSupabaseKey());

  return _client;
}

export const supabase = getSupabaseClient();

/** Wait for session after sign-in (helps right after cookie write). */
export async function waitForSession(
  timeoutMs = 6000,
  pollMs = 150,
): Promise<Session | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return null;
}