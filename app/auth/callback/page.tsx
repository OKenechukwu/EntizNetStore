// app/auth/callback/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { destinationAfterAuth } from "@/lib/auth/capabilitiesClient";
import { completePendingOnboarding } from "@/lib/auth/pendingOnboarding";

/**
 * Returns a safe internal redirect path.
 * Accepts only same-origin relative paths starting with "/".
 */
function safeInternalPath(p?: string | null): string | null {
  if (!p) return null;
  try {
    // reject absolute URLs and protocol-relative URLs
    if (
      p.startsWith("http://") ||
      p.startsWith("https://") ||
      p.startsWith("//")
    ) {
      return null;
    }
    // must be a root-relative path
    if (!p.startsWith("/")) return null;
    // Optionally, block navigating back to auth routes to avoid loops
    // if (p.startsWith("/auth")) return null;
    return p;
  } catch {
    return null;
  }
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [msg, setMsg] = useState("Verifying your session…");
  const didRedirect = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const redirectOnce = (path: string) => {
      if (didRedirect.current || cancelled) return;
      didRedirect.current = true;
      // Small delay so the success message flashes briefly
      setTimeout(() => router.replace(path), 300);
    };

    const resolveTarget = async () => {
      // Prefer explicit ?next= override if safe; otherwise the canonical
      // capability-based destination (server-derived; never from
      // client-mutable user_metadata).
      const nextParam = safeInternalPath(searchParams.get("next"));
      if (nextParam) return nextParam;
      return await destinationAfterAuth();
    };

    const run = async () => {
      try {
        // 1) If a session already exists, use it. (With PKCE +
        // detectSessionInUrl, the client may have already exchanged the
        // ?code= automatically by the time this effect runs.)
        const { data: sessionRes } = await supabase.auth.getSession();
        if (sessionRes.session) {
          // Authenticated: complete any pending buyer/seller onboarding
          // (idempotent trusted endpoint; identity derived server-side).
          await completePendingOnboarding();
          const target = await resolveTarget();
          setMsg("Success! Redirecting…");
          redirectOnce(target);
          return;
        }

        // 2) Otherwise, run the PKCE code exchange explicitly.
        const { error } = await supabase.auth.exchangeCodeForSession(
          window.location.href,
        );
        if (error) {
          // Some providers return to callback without code (e.g., user cancels)
          throw error;
        }

        // Authenticated via code exchange: complete any pending onboarding.
        await completePendingOnboarding();

        const target = await resolveTarget();
        setMsg("Success! Redirecting…");
        redirectOnce(target);
      } catch (e: any) {
        console.error("[AuthCallback] Error completing sign-in:", e);
        const reason = e?.message || "Unknown error";
        setMsg(
          `Could not complete sign-in (${reason}). You can safely close this tab or go back to the sign-in page.`,
        );
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, searchParams]);

  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold mb-3">EntizNet</h1>

      <div className="flex items-center justify-center gap-3 mb-2">
        {/* Minimal spinner */}
        <svg
          className="h-5 w-5 animate-spin"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            opacity="0.25"
          />
          <path
            d="M22 12a10 10 0 0 1-10 10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
        </svg>
        <p className="text-sm opacity-80">{msg}</p>
      </div>

      <p className="text-xs opacity-60">
        If nothing happens,{" "}
        <a href="/auth/sign-in" className="underline">
          return to sign in
        </a>
        .
      </p>
    </div>
  );
}
