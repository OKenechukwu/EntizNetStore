// ---------- components/reviews/ReviewsSection.tsx ----------
"use client";

import { Star } from "lucide-react";

interface Review {
  id: string;
  user: string;
  rating: number;
  text: string;
  images?: string[];
  date?: string;
}

export default function ReviewsSection({ reviews }: { reviews: Review[] }) {
  if (!reviews || reviews.length === 0) return null;
  return (
    <section className="mt-8 rounded-xl border p-4">
      <h3 className="mb-4 text-lg font-semibold">Reviews</h3>
      <div className="space-y-6">
        {reviews.map((r) => (
          <div key={r.id} className="border-b pb-4 last:border-b-0">
            <div className="mb-1 flex items-center gap-2 text-sm">
              <span className="font-medium">{r.user}</span>
              <span className="flex items-center text-yellow-600">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < r.rating ? "fill-current" : "opacity-30"}`}
                  />
                ))}
              </span>
              {r.date && <span className="text-xs opacity-60">{r.date}</span>}
            </div>
            <p className="text-sm">{r.text}</p>
            {r.images && r.images.length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {r.images.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={src}
                    alt="review"
                    className="aspect-square w-full rounded-md object-cover"
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
