// app/dashboard/store/new/page.tsx
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import ProductEditorForm from "@/components/seller/ProductEditorForm";

export default async function NewProductPage() {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/sign-in");

  const [sellerResult, categoriesResult, brandsResult] = await Promise.all([
    supabase.from("profiles_seller").select("verification_status").eq("id", user.id).maybeSingle(),
    supabase.from("categories").select("id, name").eq("is_active", true).order("name"),
    supabase.from("brands").select("id, name").order("name"),
  ]);

  if (!sellerResult.data) redirect("/seller/apply");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create New Product</h1>
        <p className="mt-2 text-gray-600">
          Build a complete catalogue listing, save it safely as a draft, then submit it for Admin review.
        </p>
      </div>

      <ProductEditorForm
        categories={categoriesResult.data ?? []}
        brands={brandsResult.data ?? []}
        sellerVerified={sellerResult.data.verification_status === "verified"}
      />
    </main>
  );
}
