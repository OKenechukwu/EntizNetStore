// hooks/useSupabaseSession.ts
"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";

export function useSupabaseSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return session;
}
