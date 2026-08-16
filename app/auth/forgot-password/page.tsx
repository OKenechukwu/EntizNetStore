// app/auth/forgot-password/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    setBusy(true);
    try {
      // The recovery link returns to /auth/reset-password on the same host.
      await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
    } catch {
      // Intentionally ignored — the response below is identical either way
      // so account existence is never exposed.
    } finally {
      // Always show the same generic confirmation (no account enumeration).
      setSent(true);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[80vh] items-center justify-center px-4">
      <div className="mx-auto w-full max-w-md rounded-xl border border-black/10 bg-white/95 text-black shadow-2xl backdrop-blur p-6">
        <h1 className="text-2xl font-semibold mb-2 text-center">
          Forgot password
        </h1>

        {sent ? (
          <div className="text-center">
            <p className="text-sm text-black/80 mb-6">
              If an account exists for that email address, a password reset
              link has been sent. Please check your inbox (and spam folder).
            </p>
            <Link href="/auth/sign-in" className="text-sm underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-black/70 mb-6 text-center">
              Enter your email address and we&apos;ll send you a link to reset
              your password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Email address
                </label>
                <input
                  className="w-full border rounded px-3 py-2 bg-white"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                className="luxury-button-outline w-full py-2 disabled:opacity-60"
                disabled={busy}
              >
                {busy ? "Please wait…" : "Send reset link"}
              </button>
            </form>

            <p className="mt-4 text-center text-sm">
              <Link href="/auth/sign-in" className="underline opacity-70 hover:opacity-100">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
