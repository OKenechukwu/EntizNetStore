// lib/db.ts
// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH FOR LIVE DATA
//
// The application's live marketplace data (products, sellers, orders, reviews,
// etc.) lives in the Neon Postgres database referenced by NEON_DATABASE_URL.
// The Supabase project (NEXT_PUBLIC_SUPABASE_URL) is used ONLY for auth and
// contains no application tables — do not query app data through supabase-js.
//
// Server-side only. Never import this from a client component.
// ─────────────────────────────────────────────────────────────────────────────
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __neonPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "NEON_DATABASE_URL is not set — the app cannot reach its live database."
    );
  }
  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
}

// Reuse the pool across Next.js dev hot-reloads.
export const pool: Pool = global.__neonPool ?? createPool();
if (process.env.NODE_ENV !== "production") global.__neonPool = pool;

export async function query<T = any>(
  text: string,
  params: any[] = []
): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}
