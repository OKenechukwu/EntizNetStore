"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { routeByRole } from "@/lib/auth/routeByRole";

type RoleRow = { role: string };

async function fetchRole(): Promise<string | undefined> {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return undefined;

  // Adjust this table/select to match your schema:
  // e.g. table: user_roles, columns: user_id, role
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("fetchRole error:", error.message);
    return undefined;
  }
  return (data as RoleRow | null)?.role;
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
