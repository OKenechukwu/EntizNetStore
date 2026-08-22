import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import BrandingUploader from "@/components/seller/BrandingUploader";
import StorefrontProfileEditor from "@/components/seller/StorefrontProfileEditor";

export default async function SellerBrandingPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/auth/sign-in");

  const { data: seller } = await supabase
    .from("profiles_seller")
    .select("storefront_name, store_slug, bio, logo_url, banner_url, shipping_policy, return_policy")
    .eq("id", user.id)
    .maybeSingle();

  if (!seller) redirect("/seller/apply");

  return (
    <main className="container mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-accent-gold">Seller storefront</p>
          <h1 className="mt-2 font-serif text-3xl font-bold">{seller.storefront_name}</h1>
          <p className="mt-2 max-w-2xl opacity-70">
            Manage the public identity, policies, logo, and banner used across your EntizNetStore storefront.
            Profile writes and media ownership are authorized server-side.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/store/${seller.store_slug}`} target="_blank" className="luxury-button-outline px-4 py-2">
            View public store
          </Link>
          <Link href="/dashboard/seller" className="luxury-button-outline px-4 py-2">
            Back to dashboard
          </Link>
        </div>
      </div>

      <div className="space-y-8">
        <StorefrontProfileEditor
          storeSlug={seller.store_slug}
          initialName={seller.storefront_name}
          initialBio={seller.bio ?? ""}
          initialShippingPolicy={seller.shipping_policy ?? ""}
          initialReturnPolicy={seller.return_policy ?? ""}
        />

        <section className="rounded-2xl border border-white/10 p-5">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">Logo & banner</h2>
            <p className="mt-1 text-sm opacity-65">
              JPEG, PNG, and WebP files are validated by actual file signature before becoming storefront assets.
            </p>
          </div>
          <BrandingUploader initialLogo={seller.logo_url} initialBanner={seller.banner_url} />
        </section>
      </div>
    </main>
  );
}
