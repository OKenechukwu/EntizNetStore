"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

/**
 * Hydrates the browser auth client and handles global sign-out only.
 *
 * Explicit sign-in/callback surfaces own post-auth navigation because they
 * know the caller's intended `next` destination. Supabase may emit SIGNED_IN
 * while restoring or rotating an already-authenticated session; globally
 * redirecting on that event can incorrectly yank users out of checkout,
 * Seller workflows, or any other page they intentionally opened.
 */
export default function SessionWatcher() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().finally(() => {
      if (mounted) setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (!ready) return null;
  return null;
}
