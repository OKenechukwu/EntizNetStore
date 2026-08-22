// app/dashboard/store/[id]/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import ProductLifecycleActions from "@/components/seller/ProductLifecycleActions";
import { createServerSupabase } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ id: string }> };

export default async function StoreItemPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/sign-in");

  const [productResult, sellerResult] = await Promise.all([
    supabase
      .from("products")
      .select(`
        id, title, slug, description, short_description, type, base_price,
        compare_at_price, status, moderation_status, moderation_notes,
        submitted_for_review_at, moderated_at, seller_id,
        product_media(url, position),
        product_variants(title, sku, price, inventory_quantity, is_active, position),
        product_categories(categories(name))
      `)
      .eq("id", id)
      .eq("seller_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles_seller")
      .select("verification_status")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const product = productResult.data;
  if (!product || !sellerResult.data) redirect("/dashboard/store");

  const sellerVerified = sellerResult.data.verification_status === "verified";
  const media = [...(product.product_media ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const variants = [...(product.product_variants ?? [])]
    .filter((variant) => variant.is_active)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const inventory = variants.reduce(
    (sum, variant) => sum + Number(variant.inventory_quantity ?? 0),
    0,
  );
  const moderationStatus = product.moderation_status ?? "not_submitted";

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap gap-2 text-xs uppercase tracking-wide">
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">{product.status ?? "draft"}</span>
            <span className={`rounded-full px-2.5 py-1 ${moderationStatus === "approved" ? "bg-emerald-100 text-emerald-800" : moderationStatus === "pending" ? "bg-amber-100 text-amber-800" : moderationStatus === "rejected" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700"}`}>
              moderation: {moderationStatus.replace("_", " ")}
            </span>
          </div>
          <h1 className="text-2xl font-bold">{product.title}</h1>
          {product.short_description ? <p className="mt-2 text-gray-600">{product.short_description}</p> : null}
        </div>
        <Link href={`/dashboard/store/${product.id}/edit`} className="rounded-lg bg-indigo-600 px-4 py-2 text-center text-white">
          Edit product
        </Link>
      </div>

      {product.moderation_notes ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>Admin review note:</strong> {product.moderation_notes}
        </div>
      ) : null}

      {!sellerVerified ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Seller verification is required before this product can be submitted for marketplace review.
          <Link href="/dashboard/verification" className="ml-2 font-semibold underline">Complete verification</Link>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 md:grid-cols-[260px_1fr]">
        <div className="aspect-square overflow-hidden rounded-xl bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media[0]?.url || "/attached_assets/stock_images/luxury_adult_product_04d5ddeb.jpg"}
            alt={product.title}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="space-y-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div><dt className="text-sm text-gray-500">Selling price</dt><dd className="font-semibold">${Number(product.base_price).toFixed(2)} USD</dd></div>
            <div><dt className="text-sm text-gray-500">Total inventory</dt><dd className="font-semibold">{inventory}</dd></div>
            <div><dt className="text-sm text-gray-500">Product type</dt><dd className="font-semibold capitalize">{product.type ?? "physical"}</dd></div>
            <div><dt className="text-sm text-gray-500">Images</dt><dd className="font-semibold">{media.length}</dd></div>
            <div><dt className="text-sm text-gray-500">Variants</dt><dd className="font-semibold">{variants.length}</dd></div>
            <div><dt className="text-sm text-gray-500">Categories</dt><dd className="font-semibold">{(product.product_categories ?? []).map((item: any) => item.categories?.name).filter(Boolean).join(", ") || "None"}</dd></div>
          </dl>

          <div className="rounded-xl border p-4">
            <h2 className="mb-3 font-semibold">Marketplace lifecycle</h2>
            <ProductLifecycleActions
              productId={product.id}
              sellerVerified={sellerVerified}
              status={product.status ?? "draft"}
              moderationStatus={moderationStatus}
            />
            {moderationStatus === "pending" && product.submitted_for_review_at ? (
              <p className="mt-2 text-xs text-gray-500">Submitted for review {new Date(product.submitted_for_review_at).toLocaleString()}</p>
            ) : null}
            {product.moderated_at ? (
              <p className="mt-1 text-xs text-gray-500">Last moderated {new Date(product.moderated_at).toLocaleString()}</p>
            ) : null}
          </div>
        </div>
      </div>

      {variants.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Variants & inventory</h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left">Variant</th><th className="px-4 py-2 text-left">SKU</th><th className="px-4 py-2 text-left">Price</th><th className="px-4 py-2 text-left">Inventory</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {variants.map((variant, index) => (
                  <tr key={`${variant.sku ?? "variant"}-${index}`}>
                    <td className="px-4 py-3">{variant.title}</td>
                    <td className="px-4 py-3 text-gray-600">{variant.sku || "—"}</td>
                    <td className="px-4 py-3">${Number(variant.price).toFixed(2)}</td>
                    <td className="px-4 py-3">{Number(variant.inventory_quantity ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {product.description ? <p className="mt-8 whitespace-pre-wrap text-gray-700">{product.description}</p> : null}
      {product.status === "active" && moderationStatus === "approved" ? (
        <Link href={`/products/${product.slug}`} className="mt-6 inline-block text-indigo-600 underline">View live product page</Link>
      ) : null}
    </main>
  );
}
