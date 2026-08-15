"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { routeByRole } from "@/lib/auth/routeByRole";

async function fetchRole(): Promise<string | undefined> {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return undefined;

  // Capability model: role is derived from canonical profile-row presence
  // (profiles_seller / profiles_buyer), never from a roles table or metadata.
  const { data: seller } = await supabase
    .from("profiles_seller")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (seller) return "seller";

  const { data: buyer } = await supabase
    .from("profiles_buyer")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (buyer) return "buyer";

  return undefined;
}

export default function SessionWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // On first load, hydrate auth state & update UI
    (async () => {
      const { data } = await supabase.auth.getSession();
      setReady(true);
      // No redirect on first load; we only redirect after explicit login
    })();

    // Listen for auth changes (login/logout/token refresh)
    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN") {
        const role = await fetchRole();
        const target = routeByRole(role);
        router.push(target);
      }
      if (event === "SIGNED_OUT") {
        // After logout, go to public home (change if you prefer /)
        router.push("/");
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [router]);

  // Optional: while hydrating you could show nothing or a tiny loader
  if (!ready) return null;
  return null;
}
