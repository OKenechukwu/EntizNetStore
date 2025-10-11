"use client";

import { useState } from "react";
import { supabase, waitForSession } from "@/lib/supabase/client";

export default function DevTest() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [log, setLog] = useState("");

  const append = (m: string) => setLog((s) => s + m + "\n");
  const clear = () => setLog("");

  const handleSignIn = async () => {
    clear();
    append("Signing in ...");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      append(`Sign-in error: ${error.message}`);
      return;
    }
    append(`Signed in ✓ user: ${data.user?.email || "unknown"}`);

    // Wait for session to hydrate (important on preview hosts)
    const session = await waitForSession();
    if (!session) {
      append(
        "Timeout waiting for session. Check persistSession settings and URL.",
      );
    } else {
      append(`Session OK for: ${session.user.email}`);
    }
  };

  const runFlow = async () => {
    append("Running flow...");
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      append("ERROR: No session. Please sign in above first.");
      return;
    }
    append(`Session present ✓ for: ${sess.session.user.email}`);

    // TODO: add any test read/write/storage calls here
    append("Flow OK ✓");
  };

  const checkSession = async () => {
    append("Checking session ...");
    const { data } = await supabase.auth.getSession();
    append(`Has session: ${!!data.session}`);
    if (data.session?.user?.email) {
      append(`Session user: ${data.session.user.email}`);
    }
  };

  const signOut = async () => {
    append("Signing out ...");
    const { error } = await supabase.auth.signOut();
    if (error) append(`Sign-out error: ${error.message}`);
    else append("Signed out ✓");
  };

  return (
    <div className="p-6 max-w-xl">
      <h2 className="text-lg mb-4">Supabase E2E Smoke Test</h2>

      <input
        className="w-full border rounded px-3 py-2 mb-2 bg-black/40"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-full border rounded px-3 py-2 mb-4 bg-black/40"
        placeholder="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <button className="px-4 py-2 border rounded" onClick={handleSignIn}>
          Sign in (dev-test)
        </button>
        <button className="px-4 py-2 border rounded" onClick={runFlow}>
          Run Flow
        </button>
        <button className="px-4 py-2 border rounded" onClick={checkSession}>
          Check Session
        </button>
        <button className="px-4 py-2 border rounded" onClick={signOut}>
          Sign Out
        </button>
      </div>

      <pre className="whitespace-pre-wrap text-sm">{log}</pre>
    </div>
  );
}
