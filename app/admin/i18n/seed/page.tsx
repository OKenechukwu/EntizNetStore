// app/admin/i18n/seed/page.tsx
"use client";

import { useState } from "react";

export default function AdminI18nSeedPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSeed() {
    setError(null);
    setResult(null);
    if (!token.trim()) {
      setError("Please enter your ADMIN_SEED_TOKEN first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/i18n/seed-all", {
        method: "POST",
        headers: {
          "x-admin-token": token.trim(),
        },
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-6">🌐 Bulk Seed All Locales</h1>
      <p className="mb-4 text-gray-400 max-w-md text-center">
        Enter your <code>ADMIN_SEED_TOKEN</code> from <b>.env.local</b> below to
        auto-generate translations for all supported languages.
      </p>

      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Enter ADMIN_SEED_TOKEN"
        className="px-4 py-2 w-full max-w-md text-black rounded mb-4"
      />
      <button
        onClick={handleSeed}
        disabled={loading}
        className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-6 py-2 rounded"
      >
        {loading ? "Seeding..." : "Seed All Locales"}
      </button>

      {error && (
        <p className="mt-6 text-red-400 font-mono text-sm">Error: {error}</p>
      )}
      {result && (
        <pre className="mt-6 bg-gray-900 p-4 rounded text-sm max-w-2xl overflow-x-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  );
}
