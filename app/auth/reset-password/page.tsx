// app/auth/reset-password/page.tsx
//
// Landing page for Supabase password-recovery links. The recovery link
// carries a PKCE ?code= that the browser client exchanges automatically
// (detectSessionInUrl), which establishes a recovery session and fires
// SIGNED_IN — SessionWatcher deliberately ignores that event on this page
// so the user can set a new password before navigating anywhere.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { destinationAfterAuth } from "@/lib/auth/capabilitiesClient";

type SessionState = "checking" | "ready" | "missing";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Poll briefly while the client exchanges the recovery code from the URL.
    const waitForRecoverySession = async () => {
      const deadline = Date.now() + 8000;
      while (!cancelled && Date.now() < deadline) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          if (!cancelled) setSessionState("ready");
          return;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      if (!cancelled) setSessionState("missing");
    };

    waitForRecoverySession();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Same password rule as sign-up.
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setBusy(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) {
        setError(updErr.message);
        return;
      }
      setDone(true);
      // Route to the canonical capability-based destination.
      const target = await destinationAfterAuth();
      setTimeout(() => router.replace(target), 1200);
    } catch (err: any) {
      setError(err?.message || "Could not update password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[80vh] items-center justify-center px-4">
      <div className="mx-auto w-full max-w-md rounded-xl border border-black/10 bg-white/95 text-black shadow-2xl backdrop-blur p-6">
        <h1 className="text-2xl font-semibold mb-2 text-center">
          Reset password
        </h1>

        {sessionState === "checking" && (
          <p className="text-sm text-black/70 text-center py-6">
            Verifying your reset link…
          </p>
        )}

        {sessionState === "missing" && (
          <div className="text-center py-4">
            <p className="text-sm text-black/80 mb-6">
              This password reset link is invalid or has expired. Please
              request a new one.
            </p>
            <Link
              href="/auth/forgot-password"
              className="luxury-button-outline inline-block px-6 py-2"
            >
              Request new link
            </Link>
          </div>
        )}

        {sessionState === "ready" && done && (
          <p className="text-sm text-black/80 text-center py-6">
            Password updated. Redirecting…
          </p>
        )}

        {sessionState === "ready" && !done && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                New password
              </label>
              <div className="relative">
                <input
                  className="w-full border rounded px-3 py-2 bg-white pr-24"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 border rounded"
                  aria-label={showPw ? "Hide password" : "Show password"}
                  disabled={busy}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Confirm new password
              </label>
              <input
                className="w-full border rounded px-3 py-2 bg-white"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repeat your new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              className="luxury-button-outline w-full py-2 disabled:opacity-60"
              disabled={busy}
            >
              {busy ? "Please wait…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
