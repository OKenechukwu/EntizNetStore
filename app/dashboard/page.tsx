// app/dashboard/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { routeByRole } from "@/lib/auth/routeByRole";

export default function DashboardIndex() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser();

      // Try both user_metadata.role and a plain role field for safety
      const role =
        (data.user?.user_metadata as any)?.role ??
        (data.user as any)?.role ??
        undefined;

      const target = routeByRole(role) || "/store";
      router.replace(target);
    };
    run();
  }, [router]);

  return null;
}
