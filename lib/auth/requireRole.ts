import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export async function requireRole(roles: string[] | Set<string>) {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, redirectTo: "/auth" as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const allow = Array.isArray(roles)
    ? roles.includes(profile?.role ?? "")
    : (roles as Set<string>).has(profile?.role ?? "");

  return allow
    ? { ok: true as const, user, role: profile?.role }
    : { ok: false as const, redirectTo: "/dashboard/seller" as const };
}
