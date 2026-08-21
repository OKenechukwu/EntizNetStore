import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function SellerApplyPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/auth?mode=signin&role=seller");
  }
  
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Become a Seller</h1>
      <div className="rounded-lg border border-white/10 bg-card p-8">
        <p className="text-foreground/70 mb-4">Coming soon</p>
        <p className="text-sm text-foreground/50">
          Seller application and onboarding process will be available here soon.
        </p>
      </div>
    </div>
  );
}
