"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { destinationAfterAuth } from "@/lib/auth/capabilitiesClient";

export default function ProfileIconClient() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isChecking) return;

    setIsChecking(true);
    try {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push("/auth?mode=signin");
      } else {
        // Canonical capability-based destination (server-derived).
        router.push(await destinationAfterAuth());
      }
    } catch (error) {
      router.push("/auth?mode=signin");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      aria-label="Account"
      className="rounded-lg p-2 text-foreground/90 transition hover:text-brand-secondary cursor-pointer"
    >
      <User className="h-5 w-5" />
    </div>
  );
}
