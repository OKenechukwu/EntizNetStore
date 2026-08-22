import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import ProductEditorForm from "@/components/seller/ProductEditorForm";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user }, error: sessionError } = await supabase.auth.getUser();

  if (sessionError || !user) redirect("/auth/sign-in");

  const [productResult, sellerResult, categoriesResult, brandsResult] = await Promise.all([
    supabase
      .from("products")
      .select(`
        id, title, description, short_description, type, base_price, compare_at_price,
        cost_per_item, brand_id, status, moderation_status, moderation_notes, seller_id,
        track_inventory, continue_selling, requires_shipping, is_taxable, weight_grams,
        material, age_restriction, tags, search_keywords,
        product_media(url, position),
        product_variants(
          id, title, option1, option2, option3, sku, barcode, price, compare_at_price,
          cost_per_item, track_inventory, inventory_quantity, inventory_policy,
          weight_grams, requires_shipping, is_active, position
        ),
        product_categories(category_id)
      `)
      .eq("id", id)
      .eq("seller_id", user.id)
      .single(),
    supabase.from("profiles_seller").select("verification_status").eq("id", user.id).maybeSingle(),
    supabase.from("categories").select("id, name").eq("is_active", true).order("name"),
    supabase.from("brands").select("id, name").order("name"),
  ]);

  const product = productResult.data;
  if (productResult.error || !product || !sellerResult.data) redirect("/dashboard/store");

  const media = [...(product.product_media ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const variants = [...(product.product_variants ?? [])]
    .filter((variant) => variant.is_active)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit Product</h1>
        <p className="mt-2 text-gray-600">
          Catalogue edits are saved as a new draft revision and require fresh moderation before publication.
        </p>
      </div>

      <ProductEditorForm
        categories={categoriesResult.data ?? []}
        brands={brandsResult.data ?? []}
        sellerVerified={sellerResult.data.verification_status === "verified"}
        initial={{
          id: product.id,
          title: product.title,
          description: product.description ?? "",
          shortDescription: product.short_description ?? "",
          productType: product.type === "digital" ? "digital" : "physical",
          basePrice: Number(product.base_price),
          compareAtPrice: product.compare_at_price == null ? null : Number(product.compare_at_price),
          costPerItem: product.cost_per_item == null ? null : Number(product.cost_per_item),
          brandId: product.brand_id ?? null,
          status: product.status ?? "draft",
          moderationStatus: (product.moderation_status ?? "not_submitted") as "not_submitted" | "pending" | "approved" | "rejected",
          moderationNotes: product.moderation_notes ?? null,
          categoryIds: (product.product_categories ?? []).map((item) => item.category_id),
          mediaUrls: media.map((item) => item.url),
          variants: variants.length
            ? variants.map((variant) => ({
                id: variant.id,
                title: variant.title,
                option1: variant.option1 ?? "",
                option2: variant.option2 ?? "",
                option3: variant.option3 ?? "",
                sku: variant.sku ?? "",
                barcode: variant.barcode ?? "",
                price: Number(variant.price),
                compareAtPrice: variant.compare_at_price == null ? null : Number(variant.compare_at_price),
                costPerItem: variant.cost_per_item == null ? null : Number(variant.cost_per_item),
                trackInventory: variant.track_inventory ?? true,
                inventoryQuantity: Number(variant.inventory_quantity ?? 0),
                inventoryPolicy: variant.inventory_policy === "continue" ? "continue" : "deny",
                weightGrams: variant.weight_grams == null ? null : Number(variant.weight_grams),
                requiresShipping: variant.requires_shipping ?? true,
                isActive: variant.is_active ?? true,
              }))
            : [{
                title: "Default",
                option1: "",
                option2: "",
                option3: "",
                sku: "",
                barcode: "",
                price: Number(product.base_price),
                compareAtPrice: null,
                costPerItem: null,
                trackInventory: true,
                inventoryQuantity: 0,
                inventoryPolicy: "deny",
                weightGrams: product.weight_grams == null ? null : Number(product.weight_grams),
                requiresShipping: product.requires_shipping ?? true,
                isActive: true,
              }],
          trackInventory: product.track_inventory ?? true,
          continueSelling: product.continue_selling ?? false,
          requiresShipping: product.requires_shipping ?? true,
          isTaxable: product.is_taxable ?? true,
          weightGrams: product.weight_grams == null ? null : Number(product.weight_grams),
          material: product.material ?? "",
          ageRestriction: Number(product.age_restriction ?? 18),
          tags: product.tags ?? [],
          searchKeywords: product.search_keywords ?? [],
        }}
      />
    </main>
  );
}
