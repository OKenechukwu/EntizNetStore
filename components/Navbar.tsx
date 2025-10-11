"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { routeByRole } from "@/lib/auth/routeByRole";

export default function Navbar() {
  // IMPORTANT: session === undefined means "still loading"
  const session = useSupabaseSession();

  // Render a minimal placeholder while the session hydrates to avoid flicker
  if (session === undefined) {
    return <nav className="h-14 w-full" />;
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // optional: force a client redirect to Auth
    window.location.href = "/auth";
  };

  const dashboardHref =
    routeByRole(session?.user?.user_metadata?.role) || "/dashboard";

  return (
    <nav className="flex items-center px-4 h-14 border-b">
      {/* Left side links */}
      <div className="flex items-center gap-4">
        <Link href="/" className="font-semibold">
          EntizNet
        </Link>
        <Link href="/features" className="text-sm opacity-80 hover:opacity-100">
          Features
        </Link>
        <Link href="/help" className="text-sm opacity-80 hover:opacity-100">
          Help
        </Link>
      </div>

      {/* Right side auth controls */}
      <div className="ml-auto flex items-center gap-2">
        {!session ? (
          <Link className="px-3 py-1.5 rounded-md border" href="/auth">
            Sign In
          </Link>
        ) : (
          <>
            <Link
              className="px-3 py-1.5 rounded-md border"
              href={dashboardHref}
            >
              Dashboard
            </Link>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-md border"
            >
              Sign Out
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
