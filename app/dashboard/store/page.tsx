// app/dashboard/store/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import CurrencyPicker from "@/components/CurrencyPicker";
import ProductLifecycleActions from "@/components/seller/ProductLifecycleActions";
import { formatPrice } from "@/lib/format";
import { getFxRates, convertFromBase, toCurrencyCode } from "@/lib/currency";
import { createServerSupabase } from "@/lib/supabase/server";

type ModerationStatus = "not_submitted" | "pending" | "approved" | "rejected";

type ProductRow = {
  id: string;
  title: string | null;
  base_price: number | null;
  status: string | null;
  moderation_status: ModerationStatus | null;
  moderation_notes: string | null;
  submitted_for_review_at: string | null;
  product_media: { url: string; position: number | null }[] | null;
  product_variants: { inventory_quantity: number | null; is_active: boolean | null }[] | null;
};

function moderationLabel(status: ModerationStatus | null) {
  switch (status) {
    case "pending": return "Awaiting review";
    case "approved": return "Approved";
    case "rejected": return "Changes required";
    default: return "Not submitted";
  }
}

function moderationClass(status: ModerationStatus | null) {
  switch (status) {
    case "pending": return "bg-amber-100 text-amber-800";
    case "approved": return "bg-emerald-100 text-emerald-800";
    case "rejected": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-700";
  }
}

export default async function DashboardStorePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();
  if (!user || sessionError) redirect("/auth/sign-in");

  const [productsResult, sellerResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, title, base_price, status, moderation_status, moderation_notes, submitted_for_review_at, product_media(url, position), product_variants(inventory_quantity, is_active)")
      .eq("seller_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("profiles_seller")
      .select("verification_status")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (!sellerResult.data) redirect("/seller/apply");

  const products = (productsResult.data ?? []) as ProductRow[];
  const sellerVerified = sellerResult.data.verification_status === "verified";

  const cookieStore = await cookies();
  const userCurrency = toCurrencyCode(cookieStore.get("currency")?.value);
  const rates = await getFxRates();

  const header = (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">My Products</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage catalogue content, inventory, review status, and publication.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <CurrencyPicker />
        <Link
          href="/dashboard/store/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          New Product
        </Link>
      </div>
    </div>
  );

  if (productsResult.error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        {header}
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Failed to load products. Please refresh and try again.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {header}

      {!sellerVerified ? (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          You can build and edit product drafts now. Complete Seller verification before submitting products for marketplace review.
          <Link href="/dashboard/verification" className="ml-2 font-semibold underline">Complete verification</Link>
        </div>
      ) : null}

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <h2 className="text-lg font-semibold">Your catalogue is empty</h2>
          <p className="mt-2 text-sm text-gray-600">Create your first product, add inventory and media, then submit it for review.</p>
          <Link href="/dashboard/store/new" className="mt-5 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-white">
            Create first product
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Product</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Price</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Inventory</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Moderation</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Publication</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => {
                const media = [...(product.product_media ?? [])].sort(
                  (a, b) => (a.position ?? 0) - (b.position ?? 0),
                );
                const inventory = (product.product_variants ?? []).reduce(
                  (sum, variant) => sum + (variant.is_active ? Number(variant.inventory_quantity ?? 0) : 0),
                  0,
                );
                const displayAmount = convertFromBase(Number(product.base_price ?? 0), userCurrency, rates);
                const moderation = product.moderation_status ?? "not_submitted";

                return (
                  <tr key={product.id} className="align-top">
                    <td className="px-5 py-4">
                      <div className="flex min-w-[240px] items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          className="h-16 w-16 rounded-lg object-cover"
                          src={media[0]?.url || "/attached_assets/stock_images/luxury_adult_product_04d5ddeb.jpg"}
                          alt={product.title ?? "Product"}
                        />
                        <div>
                          <Link href={`/dashboard/store/${product.id}`} className="font-medium text-gray-900 hover:underline">
                            {product.title ?? "Untitled product"}
                          </Link>
                          {product.moderation_notes ? (
                            <p className="mt-1 max-w-xs text-xs text-red-700">Review note: {product.moderation_notes}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm">{formatPrice(displayAmount, userCurrency)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-700">{inventory}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${moderationClass(moderation)}`}>
                        {moderationLabel(moderation)}
                      </span>
                      {moderation === "pending" && product.submitted_for_review_at ? (
                        <p className="mt-1 text-xs text-gray-500">Submitted {new Date(product.submitted_for_review_at).toLocaleDateString()}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${product.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"}`}>
                        {product.status === "active" ? "Live" : product.status ?? "draft"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <div className="flex min-w-[170px] flex-col gap-2">
                        <div className="flex gap-3">
                          <Link href={`/dashboard/store/${product.id}`} className="text-indigo-700 hover:underline">View</Link>
                          <Link href={`/dashboard/store/${product.id}/edit`} className="text-blue-700 hover:underline">Edit</Link>
                        </div>
                        <ProductLifecycleActions
                          productId={product.id}
                          sellerVerified={sellerVerified}
                          status={product.status ?? "draft"}
                          moderationStatus={moderation}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
