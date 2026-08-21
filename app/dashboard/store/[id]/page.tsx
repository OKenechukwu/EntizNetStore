// app/dashboard/store/[id]/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ id: string }> };

export default async function StoreItemPage({ params }: PageProps) {
  const { id } = await params;

  // Protect the page (requires signed-in user)
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, title, slug, description, base_price, compare_at_price, status, seller_id, product_media(url, position), product_variants(title, inventory_quantity, is_active), product_categories(categories(name))")
    .eq("id", id)
    .eq("seller_id", user.id)
    .maybeSingle();

  if (!product) redirect("/dashboard/store");

  const media = [...(product.product_media ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const inventory = (product.product_variants ?? []).reduce(
    (sum, variant) => sum + (variant.is_active ? Number(variant.inventory_quantity ?? 0) : 0),
    0,
  );

  return (
    <main className="max-w-3xl mx-auto p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-gray-500">{product.status}</p>
          <h1 className="text-2xl font-bold">{product.title}</h1>
        </div>
        <Link href={`/dashboard/store/${product.id}/edit`} className="rounded-lg bg-indigo-600 px-4 py-2 text-white">Edit product</Link>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[220px_1fr]">
        <div className="aspect-square overflow-hidden rounded-xl bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media[0]?.url || "/attached_assets/stock_images/luxury_adult_product_04d5ddeb.jpg"} alt={product.title} className="h-full w-full object-cover" />
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm text-gray-500">Selling price</dt><dd className="font-semibold">${Number(product.base_price).toFixed(2)} USD</dd></div>
          <div><dt className="text-sm text-gray-500">Inventory</dt><dd className="font-semibold">{inventory}</dd></div>
          <div><dt className="text-sm text-gray-500">Images</dt><dd className="font-semibold">{media.length}</dd></div>
          <div><dt className="text-sm text-gray-500">Categories</dt><dd className="font-semibold">{(product.product_categories ?? []).map((item: any) => item.categories?.name).filter(Boolean).join(", ") || "None"}</dd></div>
        </dl>
      </div>

      {product.description && <p className="mt-6 whitespace-pre-wrap text-gray-700">{product.description}</p>}
      {product.status === "active" && (
        <Link href={`/products/${product.slug}`} className="mt-6 inline-block text-indigo-600 underline">View live product page</Link>
      )}
    </main>
  );
}
