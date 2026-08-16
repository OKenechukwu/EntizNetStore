"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { destinationAfterAuth } from "@/lib/auth/capabilitiesClient";

export default function ProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      // Send to the canonical capability-based dashboard; unauthenticated
      // users land on /store.
      router.replace(await destinationAfterAuth());
    };
    run();
  }, [router]);

  return null;
}
