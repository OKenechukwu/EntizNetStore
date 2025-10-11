import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

const allowed = new Set(["brand", "supplier", "manufacturer"]);

export default async function BSMHome() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!allowed.has(profile?.role ?? "")) {
    redirect("/dashboard/seller"); // or "/dashboard"
  }

  return (
    <div className="p-6">BSM Home (Products, RFQs, Quotations, Profile)</div>
  );
}
