import Link from "next/link";
import { redirect } from "next/navigation";
import WholesaleOfferManager from "@/components/bsm/WholesaleOfferManager";
import { createServerSupabase } from "@/lib/supabase/server";

type ProductRow = {
  id: string;
  title: string | null;
};

type VariantRow = {
  id: string;
  product_id: string;
  title: string | null;
  sku: string | null;
  price: number | string | null;
  inventory_quantity: number | null;
  is_active: boolean | null;
};

export default async function BsmWholesaleDashboardPage() {
  const supabase = await createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) redirect("/auth?mode=signin&role=bsm&next=/dashboard/bsm/wholesale");

  const [businessResult, sellerResult, productsResult] = await Promise.all([
    supabase
      .from("profiles_business")
      .select("display_name, verification_status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles_seller")
      .select("verification_status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("products")
      .select("id, title")
      .eq("seller_id", user.id)
      .eq("status", "active")
      .eq("moderation_status", "approved")
      .order("updated_at", { ascending: false }),
  ]);

  if (!businessResult.data) redirect("/bsm/apply");
  if (!sellerResult.data) redirect("/bsm/apply");

  const verified = businessResult.data.verification_status === "verified"
    && sellerResult.data.verification_status === "verified";

  const products = (productsResult.data || []) as ProductRow[];
  const productIds = products.map((product) => product.id);
  const variantsResult = productIds.length
    ? await supabase
        .from("product_variants")
        .select("id, product_id, title, sku, price, inventory_quantity, is_active")
        .in("product_id", productIds)
        .eq("is_active", true)
        .order("position", { ascending: true })
    : { data: [] as VariantRow[], error: null };

  const productMap = new Map(products.map((product): [string, ProductRow] => [product.id, product]));
  const variants = ((variantsResult.data || []) as VariantRow[]).flatMap((variant) => {
    const product = productMap.get(variant.product_id);
    if (!product) return [];
    return [{
      productId: product.id,
      productTitle: product.title || "Untitled product",
      variantId: variant.id,
      variantTitle: variant.title || "Default variant",
      sku: variant.sku,
      inventoryQuantity: Number(variant.inventory_quantity || 0),
      retailPriceCents: Math.max(0, Math.round(Number(variant.price || 0) * 100)),
    }];
  });

  const catalogueError = productsResult.error || variantsResult.error;

  return (
    <div className="container mx-auto space-y-8 px-4 py-10">
      <header className="glass-card p-6 md:p-8">
        <p className="text-sm uppercase tracking-wide text-accent-gold">Business / BSM</p>
        <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold">Wholesale offers</h1>
            <p className="mt-2 max-w-3xl text-sm opacity-70">
              Publish business-scale terms against your canonical product variants. Retail products, wholesale terms, inventory and checkout remain one connected commerce system.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/bsm" className="luxury-button-outline inline-flex min-h-11 items-center px-4">BSM dashboard</Link>
            <Link href="/dashboard/store" className="luxury-button-outline inline-flex min-h-11 items-center px-4">Products</Link>
          </div>
        </div>
      </header>

      {!verified ? (
        <section className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-5">
          <h2 className="font-semibold text-accent-gold">Business verification required</h2>
          <p className="mt-2 text-sm opacity-75">
            Wholesale publishing is restricted to verified Business/BSM Sellers. Complete verification before creating active offers.
          </p>
          <Link href="/dashboard/verification" className="luxury-button mt-4 inline-flex min-h-11 items-center px-4">Complete verification</Link>
        </section>
      ) : catalogueError ? (
        <section role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-5 text-sm text-red-300">
          Your approved catalogue could not be loaded. Refresh and try again before changing wholesale terms.
        </section>
      ) : (
        <WholesaleOfferManager variants={variants} />
      )}
    </div>
  );
}
