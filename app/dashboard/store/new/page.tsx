// app/dashboard/store/new/page.tsx
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import ProductEditorForm from "@/components/seller/ProductEditorForm";

export default async function NewProductPage() {
  const supabase = await createServerSupabase();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/sign-in");
  }

  const [sellerResult, categoriesResult] = await Promise.all([
    supabase.from("profiles_seller").select("verification_status").eq("id", user.id).maybeSingle(),
    supabase.from("categories").select("id, name").eq("is_active", true).order("name"),
  ]);

  if (!sellerResult.data) redirect("/seller/apply");

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create New Product</h1>
        <p className="text-gray-600 mt-2">Add catalog, pricing, inventory, and publishing information.</p>
      </div>

      <ProductEditorForm
        categories={categoriesResult.data ?? []}
        sellerVerified={sellerResult.data.verification_status === "verified"}
      />
    </main>
  );
}
