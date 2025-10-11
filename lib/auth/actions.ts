// lib/auth/actions.ts
"use client";
import { supabase } from "@/lib/supabase/client";

/** Email + password sign-up (uses email verification link) */
export async function signUpEmailPassword(email: string, password: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      // send user back to the SAME host they used (dev/prod/Replit/Bolt)
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}

/** Magic-link sign-in (no password) */
export async function signInMagicLink(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}

/** Normal password sign-in */
export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

/** Sign out */
export async function signOut() {
  return supabase.auth.signOut();
}
