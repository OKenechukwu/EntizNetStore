import { redirect } from "next/navigation";
import VerificationClient from "@/components/seller/VerificationClient";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function VerificationPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/auth?mode=signin&role=seller");

  const { data: seller } = await supabase
    .from("profiles_seller")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!seller) redirect("/seller/apply");

  return <VerificationClient />;
}
