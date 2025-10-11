"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Brand } from "@/components/ui/Brand";

const SLIDES = [
  {
    h1: "Elevate your intimacy.",
    sub: "Experience curated quality, verified sellers, and discreet delivery.",
    img: "/demo/hero/slide1.jpg",
  },
  {
    h1: "Verified. Discreet. Premium.",
    sub: "Shop with confidence. Privacy-first, always.",
    img: "/demo/hero/slide2.jpg",
  },
  {
    h1: "Curated for every mood.",
    sub: "From wellness to wearables — find your perfect match.",
    img: "/demo/hero/slide3.jpg",
  },
];

export default function HeroSlider() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % SLIDES.length), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative h-[64vh] min-h-[420px] overflow-hidden">
      {SLIDES.map((s, k) => (
        <div
          key={k}
          className={`absolute inset-0 transition-opacity duration-700 ${k === i ? "opacity-100" : "opacity-0"}`}
        >
          <Image
            src={s.img}
            alt={s.h1}
            fill
            priority={k === 0}
            className="object-cover brightness-[.65]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/70" />
          <div className="relative z-10 mx-auto max-w-screen-xl px-4 pt-20">
            <div className="tracking-[0.12em] uppercase font-bold opacity-90">
              World’s No. 1 • Premium Wellness
            </div>
            <h1 className="mt-2 text-[clamp(36px,5vw,64px)] font-extrabold">
              {s.h1}
            </h1>
            <p className="mt-2 max-w-[760px] opacity-95">{s.sub}</p>
            <div className="mt-4 flex gap-3">
              <a
                href="#"
                className={`rounded-xl2 border border-white/15 px-4 py-2 font-bold ${Brand.grad}`}
              >
                Shop Featured
              </a>
              <a
                href="#"
                className="rounded-xl2 border border-white/15 bg-black/30 px-4 py-2 font-bold"
              >
                Browse All
              </a>
            </div>
          </div>
        </div>
      ))}

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 transform">
        <div className="flex gap-2">
          {SLIDES.map((_, k) => (
            <button
              key={k}
              onClick={() => setI(k)}
              className={`h-2.5 w-2.5 rounded-full border border-white/70 ${k === i ? "bg-white" : "bg-white/30"}`}
              aria-label={`Go to slide ${k + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
