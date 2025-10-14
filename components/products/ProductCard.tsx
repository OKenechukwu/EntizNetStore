// components/product/ProductCard.tsx
import Link from "next/link";
import Image from "next/image";
import Price from "@/components/ui/Price";

export type ProductCardData = {
  id: string | number;
  slug: string; // e.g. "lelo-sila-2"
  name: string; // product title
  brand?: string; // optional brand
  image: string; // public path or URL
  price: number | string; // will be formatted by <Price/>
  badge?: string; // optional small tag like "New" or "-20%"
};

export default function ProductCard({ product }: { product: ProductCardData }) {
  const { slug, name, brand, image, price, badge } = product;

  return (
    <Link
      href={`/p/${slug}`}
      className="group overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.04] backdrop-blur transition hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-white/30"
    >
      {/* Media */}
      <div className="relative aspect-[4/3]">
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover transition will-change-transform group-hover:scale-[1.02]"
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
          priority={false}
        />
        {badge ? (
          <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
            {badge}
          </span>
        ) : null}
      </div>

      {/* Content */}
      <div className="p-3">
        {brand ? (
          <div className="text-[11px] uppercase tracking-wide text-white/60">
            {brand}
          </div>
        ) : null}
        <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold">{name}</h3>

        <div className="mt-2 text-base font-extrabold">
          <Price amount={price} />
        </div>
      </div>
    </Link>
  );
}

/* Optional: tiny skeleton for loading lists */
export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.04]">
      <div className="aspect-[4/3] animate-pulse bg-white/[0.06]" />
      <div className="p-3">
        <div className="mb-2 h-3 w-16 animate-pulse rounded bg-white/[0.08]" />
        <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-white/[0.08]" />
        <div className="h-5 w-20 animate-pulse rounded bg-white/[0.12]" />
      </div>
    </div>
  );
}
