import { createServerSupabase } from "@/lib/supabase/server";

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
};

export async function getCatalogCategories(
  marketplaceBrand = "entiznetstore",
): Promise<CatalogCategory[]> {
  const supabase = await createServerSupabase();
  const [categoriesResult, linksResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, description, image_url, sort_order")
      .eq("is_active", true)
      .is("parent_id", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("product_categories")
      .select("category_id, products!inner(id)")
      .eq("products.status", "active")
      .eq("products.marketplace_brand", marketplaceBrand),
  ]);

  if (categoriesResult.error) throw categoriesResult.error;
  if (linksResult.error) throw linksResult.error;

  const counts = new Map<string, number>();
  for (const link of linksResult.data ?? []) {
    counts.set(link.category_id, (counts.get(link.category_id) ?? 0) + 1);
  }

  return (categoriesResult.data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imageUrl: category.image_url,
    productCount: counts.get(category.id) ?? 0,
  }));
}

export async function getCatalogCategory(slug: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("categories")
    .select("id, parent_id, name, slug, description, image_url")
    .eq("slug", slug)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
