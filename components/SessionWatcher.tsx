"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { destinationAfterAuth } from "@/lib/auth/capabilitiesClient";

export default function SessionWatcher() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // On first load, hydrate auth state & update UI
    (async () => {
      await supabase.auth.getSession();
      setReady(true);
      // No redirect on first load; we only redirect after explicit login
    })();

    // Listen for auth changes (login/logout/token refresh)
    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN") {
        // Recovery links and the OAuth/PKCE callback sign the user in on
        // their own pages, which handle navigation themselves — do not
        // yank the user away from them.
        const path = window.location.pathname;
        if (
          path.startsWith("/auth/reset-password") ||
          path.startsWith("/auth/callback")
        ) {
          return;
        }
        // Canonical capability-based destination (server-derived).
        router.push(await destinationAfterAuth());
      }
      if (event === "SIGNED_OUT") {
        // After logout, go to public home
        router.push("/");
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (!ready) return null;
  return null;
}
