"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { isTrustedPublicMediaSource } from "@/lib/storage/publicMedia";

interface GalleryProps {
  images: { src: string; alt?: string }[];
}

export default function ProductGallery({ images }: GalleryProps) {
  const safeImages = useMemo(
    () => (images ?? []).filter((image) => isTrustedPublicMediaSource(image.src)),
    [images],
  );
  const [active, setActive] = useState(0);
  const displayIndex = Math.min(active, Math.max(safeImages.length - 1, 0));
  const current = safeImages[displayIndex] ?? safeImages[0];

  if (!current) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-xl border bg-white/5 text-sm text-foreground/50">
        No images available
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border">
        <Image
          src={current.src}
          alt={current.alt || "product"}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>
      {safeImages.length > 1 ? (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {safeImages.map((img, i) => (
            <button
              key={`${img.src}-${i}`}
              onClick={() => setActive(i)}
              className={`relative aspect-square overflow-hidden rounded-md border ${
                i === displayIndex ? "ring-2 ring-pink-600" : ""
              }`}
              aria-label={`View product image ${i + 1}`}
            >
              <Image
                src={img.src}
                alt={img.alt || "thumb"}
                fill
                className="object-cover"
                sizes="96px"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
