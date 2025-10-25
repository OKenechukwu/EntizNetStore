// ---------- components/product/ProductGallery.tsx ----------
"use client";


import { useState } from "react";


interface GalleryProps {
images: { src: string; alt?: string }[];
}


export default function ProductGallery({ images }: GalleryProps) {
const [active, setActive] = useState(0);
const current = images[active] ?? images[0];
return (
<div className="w-full">
<div className="aspect-square w-full overflow-hidden rounded-xl border">
{/* eslint-disable-next-line @next/next/no-img-element */}
<img src={current.src} alt={current.alt || "product"} className="h-full w-full object-cover" />
</div>
<div className="mt-3 grid grid-cols-5 gap-2">
{images.map((img, i) => (
<button
key={i}
onClick={() => setActive(i)}
className={`aspect-square overflow-hidden rounded-md border ${i===active ? "ring-2 ring-pink-600" : ""}`}
>
{/* eslint-disable-next-line @next/next/no-img-element */}
<img src={img.src} alt={img.alt || "thumb"} className="h-full w-full object-cover" />
</button>
))}
</div>
</div>
);
}