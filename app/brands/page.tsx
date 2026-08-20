import Image from "next/image";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { getCatalogBrands } from "@/lib/data/brands";

export default async function BrandsPage() {
  const brands = await getCatalogBrands("entiznetstore");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <header className="mx-auto mb-10 max-w-2xl text-center">
          <h1 className="text-3xl font-bold md:text-4xl">Brands &amp; Creators</h1>
          <p className="mt-3 text-foreground/65">
            Discover brands with active products in the EntizNetStore catalog.
          </p>
        </header>

        {brands.length === 0 ? (
          <section className="rounded-xl border border-white/10 bg-card p-10 text-center">
            <h2 className="text-xl font-semibold">No brands published yet</h2>
            <p className="mt-2 text-sm text-foreground/60">
              Brands will appear here after their first active product is published.
            </p>
          </section>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/brands/${brand.slug}`}
                className="group rounded-xl border border-white/10 bg-card p-6 transition hover:-translate-y-0.5 hover:border-brand-secondary/50"
              >
                <div className="flex items-center gap-4">
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xl font-bold">
                    {brand.logoUrl ? (
                      <Image src={brand.logoUrl} alt="" fill sizes="64px" className="object-cover" />
                    ) : (
                      brand.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold">{brand.name}</h2>
                      {brand.isVerified && <BadgeCheck className="h-5 w-5 text-brand-secondary" aria-label="Verified" />}
                    </div>
                    <p className="mt-1 text-sm text-foreground/55">
                      {brand.productCount} {brand.productCount === 1 ? "product" : "products"}
                    </p>
                  </div>
                </div>
                {brand.description && (
                  <p className="mt-5 line-clamp-3 text-sm text-foreground/65">{brand.description}</p>
                )}
                <p className="mt-5 text-sm font-medium text-brand-secondary">View products →</p>
              </Link>
            ))}
          </section>
        )}

        <section className="mx-auto mt-14 max-w-3xl rounded-xl border border-white/10 bg-card p-8 text-center">
          <h2 className="text-2xl font-bold">Sell on EntizNetStore</h2>
          <p className="mx-auto mt-3 max-w-xl text-foreground/65">
            Apply as a seller to publish products after identity and business verification.
          </p>
          <Link href="/seller/apply" className="mt-6 inline-block rounded-lg bg-brand-secondary px-6 py-3 font-semibold text-black">
            Apply to sell
          </Link>
        </section>
      </div>
    </main>
  );
}
