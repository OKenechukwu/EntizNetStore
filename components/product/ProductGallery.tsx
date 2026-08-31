// components/product/ProductGallery.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isTrustedPublicMediaSource } from "@/lib/storage/publicMedia";
import type { ProductImage } from "@/types/product";

type Props = {
  images: ProductImage[];
  productName: string;
};

export default function ProductGallery({ images, productName }: Props) {
  const safeImages = useMemo(
    () => (images ?? []).filter((image) => isTrustedPublicMediaSource(image.url)),
    [images],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const displayIndex = Math.min(selectedIndex, Math.max(safeImages.length - 1, 0));
  const currentImage = safeImages[displayIndex] || safeImages[0];
  const minSwipeDistance = 50;

  const goNext = useCallback(() => {
    setSelectedIndex((prev) => {
      const current = Math.min(prev, Math.max(safeImages.length - 1, 0));
      return current < safeImages.length - 1 ? current + 1 : current;
    });
  }, [safeImages.length]);

  const goPrev = useCallback(() => {
    setSelectedIndex((prev) => {
      const current = Math.min(prev, Math.max(safeImages.length - 1, 0));
      return current > 0 ? current - 1 : current;
    });
  }, [safeImages.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  // Touch swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (touchStart === null || touchEnd === null) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      goNext();
    } else if (isRightSwipe) {
      goPrev();
    }
  };

  if (!currentImage || safeImages.length === 0) {
    return (
      <div className="w-full aspect-square bg-white/5 rounded-xl flex items-center justify-center">
        <span className="text-white/40">No images available</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Main Image */}
      <div
        className="relative w-full aspect-square rounded-xl overflow-hidden bg-white/5 group"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Image
          src={currentImage.url}
          alt={currentImage.alt || productName}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />

        {/* Navigation Arrows */}
        {safeImages.length > 1 && (
          <>
            <button
              onClick={goPrev}
              disabled={displayIndex === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white opacity-0 transition hover:bg-black/80 disabled:opacity-30 group-hover:opacity-100"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              onClick={goNext}
              disabled={displayIndex === safeImages.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white opacity-0 transition hover:bg-black/80 disabled:opacity-30 group-hover:opacity-100"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Image Counter */}
        {safeImages.length > 1 && (
          <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
            {displayIndex + 1} / {safeImages.length}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {safeImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {safeImages.map((img, index) => (
            <button
              key={`${img.url}-${index}`}
              onClick={() => setSelectedIndex(index)}
              className={`
                relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition
                ${
                  index === displayIndex
                    ? "border-brand-secondary"
                    : "border-white/10 hover:border-white/30"
                }
              `}
              aria-label={`View image ${index + 1}`}
            >
              <Image
                src={img.url}
                alt={img.alt || `${productName} - Image ${index + 1}`}
                fill
                className="object-cover"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
