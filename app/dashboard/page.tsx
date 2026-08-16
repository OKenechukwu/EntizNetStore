// app/dashboard/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { destinationAfterAuth } from "@/lib/auth/capabilitiesClient";

export default function DashboardIndex() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      // Canonical capability-based destination (server-derived);
      // unauthenticated users land on /store.
      router.replace(await destinationAfterAuth());
    };
    run();
  }, [router]);

  return null;
}
