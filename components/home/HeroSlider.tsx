"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Brand } from "@/components/ui/Brand";
import { T, useI18n } from "@/components/i18n/I18nProvider";
import { Search } from "lucide-react";

const SLIDE_KEYS = [
  {
    h1: "home.slider.slide1.title",
    sub: "home.slider.slide1.subtitle",
    img: "/demo/hero/slide1.jpg",
  },
  {
    h1: "home.slider.slide2.title",
    sub: "home.slider.slide2.subtitle",
    img: "/demo/hero/slide2.jpg",
  },
  {
    h1: "home.slider.slide3.title",
    sub: "home.slider.slide3.subtitle",
    img: "/demo/hero/slide3.jpg",
  },
];

export default function HeroSlider() {
  const { t } = useI18n();
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setI((p) => (p + 1) % SLIDE_KEYS.length),
      4000,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative h-[64vh] min-h-[420px] overflow-hidden">
      {SLIDE_KEYS.map((s, k) => (
        <div
          key={k}
          className={`absolute inset-0 transition-opacity duration-700 ${
            k === i ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={s.img}
            alt={t(s.h1)}
            fill
            priority={k === 0}
            className="object-cover brightness-[.65]"
          />
          {/* subtle top→bottom veil */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/70" />

          {/* Main overlay content */}
          <div className="relative z-10 mx-auto max-w-screen-xl px-4 pt-20">
            {/* Small badge */}
            <div className="uppercase font-bold tracking-[0.12em] opacity-90">
              {t("home.slider.badge")}
            </div>

            {/* Slide title + subtitle */}
            <h1 className="mt-2 text-[clamp(36px,5vw,64px)] font-extrabold">
              {t(s.h1)}
            </h1>
            <p className="mt-2 max-w-[760px] opacity-95">{t(s.sub)}</p>

            {/* CTAs */}
            <div className="mt-4 flex gap-3">
              <a
                href="#"
                className={`rounded-xl2 border border-white/15 px-4 py-2 font-bold ${Brand.grad}`}
              >
                {t("home.slider.ctaFeatured")}
              </a>
              <a
                href="#"
                className="rounded-xl2 border border-white/15 bg-black/30 px-4 py-2 font-bold"
              >
                {t("home.slider.ctaBrowseAll")}
              </a>
            </div>

            {/* Search input (localized placeholder + aria) */}
            <div className="mt-6 max-w-xl">
              <label htmlFor="hero-search" className="sr-only">
                {t("search.aria")}
              </label>
              <div className="flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 text-black backdrop-blur">
                <Search className="h-5 w-5 opacity-70" aria-hidden="true" />
                <input
                  id="hero-search"
                  placeholder={t("search.placeholder")}
                  aria-label={t("search.aria")}
                  className="w-full bg-transparent placeholder-black/50 outline-none"
                />
              </div>
            </div>

            {/* “Shop by Category” mini banner (yellow heading + subtext) */}
            <div className="mt-8">
              <h2 className="text-xl font-extrabold text-yellow-400">
                <T k="home.shopByCategory" />
              </h2>
              <p className="opacity-80">
                <T k="home.shopByCategorySub" />
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 transform">
        <div className="flex gap-2">
          {SLIDE_KEYS.map((_, k) => (
            <button
              key={k}
              onClick={() => setI(k)}
              className={`h-2.5 w-2.5 rounded-full border border-white/70 ${
                k === i ? "bg-white" : "bg-white/30"
              }`}
              aria-label={t("home.slider.dot")}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
