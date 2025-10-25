"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { routeByRole } from "@/lib/auth/routeByRole";

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
        const role = data.user.user_metadata?.role as string | undefined;
        const dashboardPath = routeByRole(role);
        router.push(dashboardPath);
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
