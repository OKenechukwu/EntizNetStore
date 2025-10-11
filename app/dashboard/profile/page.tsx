"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { routeByRole } from "@/lib/auth/routeByRole";

export default function ProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      const role =
        (data.user?.user_metadata as any)?.role ??
        (data.user as any)?.role ??
        undefined;
      // Send to that role’s profile subpage. If your buyer page contains profile,
      // point to /dashboard/buyer; otherwise use /dashboard/buyer/profile.
      router.replace(`${routeByRole(role) || "/store"}`);
    };
    run();
  }, [router]);

  return null;
}
