import { createServerSupabase } from "@/lib/supabase/server";

export async function getCatalogBrands(marketplaceBrand = "entiznetstore") {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, slug, description, logo_url, is_verified, products!inner(id)")
    .eq("products.status", "active")
    .eq("products.marketplace_brand", marketplaceBrand)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((brand: any) => ({
    id: brand.id as string,
    name: brand.name as string,
    slug: brand.slug as string,
    description: brand.description as string | null,
    logoUrl: brand.logo_url as string | null,
    isVerified: Boolean(brand.is_verified),
    productCount: (brand.products ?? []).length,
  }));
}

export async function getCatalogBrand(slug: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, slug, description, logo_url, banner_url, is_verified")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
