"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

export function useEnsureRoleMetadata() {
  const session = useSupabaseSession();
  const busyRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      if (busyRef.current) return;
      if (session === undefined) return; // still loading
      const user = session?.user;
      if (!user) return; // signed out
      const hasRole = !!user.user_metadata?.role;
      if (hasRole) return;

      busyRef.current = true;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!error && data?.role) {
        await supabase.auth.updateUser({ data: { role: data.role } });
      }
      busyRef.current = false;
    };

    run();
  }, [session]);
}
