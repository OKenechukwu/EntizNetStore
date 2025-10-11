"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type BSM = {
  id: string;
  company_name: string;
  company_type: string;
  logo_url?: string;
  categories?: string[];
  product_count?: number;
  min_price?: number;
  max_price?: number;
};

export default function BSMMall() {
  const [list, setList] = useState<BSM[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch("/api/bsm/search?q=" + encodeURIComponent(q));
      const data = await res.json();
      setList(data.items ?? []);
      setLoading(false);
    })();
  }, [q]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <input
          className="input input-bordered w-full"
          placeholder="Search Brands, Suppliers, Manufacturers..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {list.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/vendor/bsm/${b.id}`}
              className="border rounded-xl p-4 hover:shadow"
            >
              {b.logo_url && (
                <img
                  src={b.logo_url}
                  alt={b.company_name}
                  className="w-16 h-16 object-cover rounded-full mb-2"
                />
              )}
              <div className="text-xs uppercase opacity-60">
                {b.company_type}
              </div>
              <div className="font-semibold text-lg">{b.company_name}</div>
              <div className="text-xs mt-1 opacity-70">
                {b.categories?.join(" • ")}
              </div>
              <div className="text-xs mt-1">
                {b.product_count ?? 0} products
                {b.min_price && (
                  <>
                    {" "}
                    · ${b.min_price} – ${b.max_price}
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
