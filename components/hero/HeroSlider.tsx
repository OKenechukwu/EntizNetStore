// components/hero/HeroSlider.tsx
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import SafeVideo from "@/components/media/SafeVideo";
import { useBrand } from "@/components/BrandProvider";
import { T } from "@/components/i18n/I18nProvider";

interface CTA {
  text: string;
  href: string;
  primary?: boolean;
}

interface HeroSlide {
  id: string;
  type: "image" | "video";
  src: string;
  alt: string;
  poster?: string; // for video
  title: string;
  subtitle: string;
  cta1: CTA;
  cta2?: CTA;
}

interface HeroSliderProps {
  slides?: HeroSlide[];
  autoplayInterval?: number; // ms
  className?: string;
}

const defaultSlides: HeroSlide[] = [
  {
    id: "1",
    type: "image",
    src: "/images/hero/luxury-collection.jpg",
    alt: "Luxury Adult Wellness Collection",
    title: "Luxury Adult Wellness",
    subtitle:
      "Discover premium intimate products designed for your pleasure and wellbeing.",
    cta1: {
      text: "Explore Collection",
      href: "/collections/premium",
      primary: true,
    },
    cta2: { text: "Browse Categories", href: "/categories" },
  },
  {
    id: "2",
    type: "video",
    src: "/videos/hero/wellness-experience.mp4",
    poster: "/images/hero/wellness-poster.jpg",
    alt: "Premium Wellness Experience",
    title: "Elevate Your Intimacy",
    subtitle:
      "Experience the finest in adult wellness with our curated premium selection.",
    cta1: { text: "Shop Premium", href: "/premium", primary: true },
    cta2: { text: "Learn More", href: "/about" },
  },
  {
    id: "3",
    type: "image",
    src: "/images/hero/discreet-luxury.jpg",
    alt: "Discreet Luxury Shopping",
    title: "Discreet & Luxurious",
    subtitle:
      "Private shopping with premium packaging and discreet worldwide delivery.",
    cta1: { text: "Start Shopping", href: "/store", primary: true },
    cta2: { text: "Privacy Policy", href: "/privacy" },
  },
];

export default function HeroSlider({
  slides = defaultSlides,
  autoplayInterval = 18000,
  className = "",
}: HeroSliderProps) {
  const { theme } = useBrand();

  // Respect reduced motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    );
  }, []);

  const [current, setCurrent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(!prefersReducedMotion);
  const [isHoverPaused, setIsHoverPaused] = useState(false);
  const [videoFailedOnce, setVideoFailedOnce] = useState<
    Record<string, boolean>
  >({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentSlide = slides[current];

  // Announce slide change for SR users
  const announceSlideChange = useCallback(
    (index: number) => {
      const el = document.createElement("div");
      el.setAttribute("aria-live", "polite");
      el.setAttribute("aria-atomic", "true");
      el.className = "sr-only";
      el.textContent = `Slide ${index + 1} of ${slides.length}: ${slides[index].title}`;
      document.body.appendChild(el);
      setTimeout(() => {
        if (document.body.contains(el)) document.body.removeChild(el);
      }, 1000);
    },
    [slides],
  );

  useEffect(() => {
    if (typeof window !== "undefined") announceSlideChange(current);
  }, [current, announceSlideChange]);

  // Autoplay
  useEffect(() => {
    if (!isPlaying || isHoverPaused || prefersReducedMotion) return;
    timerRef.current = setInterval(() => {
      setCurrent((p) => (p + 1) % slides.length);
    }, autoplayInterval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [
    isPlaying,
    isHoverPaused,
    prefersReducedMotion,
    autoplayInterval,
    slides.length,
  ]);

  const goTo = (index: number) => setCurrent(index);

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        goTo((current - 1 + slides.length) % slides.length);
        break;
      case "ArrowRight":
        e.preventDefault();
        goTo((current + 1) % slides.length);
        break;
      case " ":
        e.preventDefault();
        setIsPlaying((s) => !s);
        break;
      case "Escape":
        setIsPlaying(false);
        break;
    }
  };

  const handleVideoErrorOnce = (id: string) => {
    // Mark failed and let UI fall back to poster (no retry storm)
    setVideoFailedOnce((m) => ({ ...m, [id]: true }));
  };

  const gradientOverlay =
    "absolute inset-0 bg-gradient-to-t from-[color:var(--overlay-strong,rgba(0,0,0,0.6))] via-[color:var(--overlay-mid,rgba(0,0,0,0.25))] to-transparent";

  const pillClass =
    "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-105";
  const primaryBtn =
    "px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 bg-[var(--brand-primary)] text-[var(--brand-text,#fff)] hover:opacity-90";
  const outlineBtn =
    "px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 bg-white/10 text-white border border-white/30 hover:bg-white/20 backdrop-blur-sm";

  return (
    <section
      className={`relative w-full h-[70vh] min-h-[500px] overflow-hidden ${className}`}
      tabIndex={0}
      role="region"
      aria-label="Hero carousel"
      aria-roledescription="carousel"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setIsHoverPaused(true)}
      onMouseLeave={() => setIsHoverPaused(false)}
    >
      {/* Slides */}
      <AnimatePresence mode="wait">
        <motion.div
          key={
            currentSlide.id +
            (currentSlide.type === "video" && videoFailedOnce[currentSlide.id]
              ? "-fallback"
              : "")
          }
          role="group"
          aria-roledescription="slide"
          aria-label={`Slide ${current + 1} of ${slides.length}: ${currentSlide.title}`}
          initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.99 }}
          transition={{
            duration: prefersReducedMotion ? 0.2 : 0.7,
            ease: "easeInOut",
          }}
          className="absolute inset-0"
        >
          {currentSlide.type === "video" &&
          !videoFailedOnce[currentSlide.id] ? (
            <SafeVideo
              src={currentSlide.src}
              poster={currentSlide.poster}
              className="w-full h-full object-cover"
              autoPlay
              loop={false}
              muted
              playsInline
              preload="none"
              onError={() => handleVideoErrorOnce(currentSlide.id)}
            />
          ) : (
            <Image
              src={currentSlide.poster || currentSlide.src}
              alt={currentSlide.alt}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          )}

          {/* Overlay */}
          <div className={gradientOverlay} />
        </motion.div>
      </AnimatePresence>

      {/* Copy & CTAs */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="max-w-4xl mx-auto px-6 text-center text-white">
          <motion.h1
            key={`h-${currentSlide.id}`}
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0.2 : 0.6,
              delay: 0.2,
            }}
            className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold mb-6"
            style={{ textShadow: "0 4px 20px rgba(0,0,0,0.5)" }}
          >
            {currentSlide.title}
          </motion.h1>

          <motion.p
            key={`p-${currentSlide.id}`}
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0.2 : 0.6,
              delay: 0.35,
            }}
            className="text-lg md:text-xl lg:text-2xl mb-8 text-white/90 leading-relaxed mx-auto max-w-3xl"
            style={{ textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}
          >
            {currentSlide.subtitle}
          </motion.p>

          <motion.div
            key={`cta-${currentSlide.id}`}
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0.2 : 0.6,
              delay: 0.5,
            }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link
              href={currentSlide.cta1.href}
              className={currentSlide.cta1.primary ? primaryBtn : outlineBtn}
            >
              {currentSlide.cta1.text}
            </Link>
            {currentSlide.cta2 && (
              <Link
                href={currentSlide.cta2.href}
                className={currentSlide.cta2.primary ? primaryBtn : outlineBtn}
              >
                {currentSlide.cta2.text}
              </Link>
            )}
          </motion.div>
        </div>
      </div>

      {/* Category pills */}
      <motion.div
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0.2 : 0.5, delay: 0.7 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="flex flex-wrap gap-3 justify-center">
          {["Wellness", "Massage", "Luxury", "Premium", "Discreet"].map(
            (tag) => (
              <Link
                key={tag}
                href={`/categories/${tag.toLowerCase()}`}
                className={pillClass}
                style={{
                  background:
                    "linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))",
                  color: "var(--brand-text, #fff)",
                  opacity: 0.95,
                }}
              >
                {tag}
              </Link>
            ),
          )}
        </div>
      </motion.div>

      {/* Slide navigation */}
      <nav className="absolute bottom-2 right-4" aria-label="Slide navigation">
        <div className="flex gap-1">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === current ? "true" : undefined}
              aria-label={`Go to slide ${i + 1}: ${s.title}`}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 hover:scale-110"
            >
              <span
                aria-hidden="true"
                className={`block w-3 h-3 rounded-full transition-all duration-300 ${
                  i === current
                    ? "bg-white shadow-lg scale-110"
                    : "bg-white/50 group-hover:bg-white/70"
                }`}
              />
            </button>
          ))}
        </div>
      </nav>

      {/* Play / Pause */}
      <button
        onClick={() => setIsPlaying((p) => !p)}
        className="absolute top-4 right-4 w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-all duration-300"
        aria-label={isPlaying ? "Pause slideshow" : "Play slideshow"}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg
            className="w-6 h-6 ml-0.5"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Video badge */}
      {currentSlide.type === "video" && !videoFailedOnce[currentSlide.id] && (
        <div className="absolute top-4 left-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm text-white text-sm">
            <span
              className="w-2 h-2 rounded-full bg-red-500 animate-pulse"
              aria-hidden="true"
            />
            <span><T k="hero.videoLabel" /></span>
          </div>
        </div>
      )}

      {/* SR instructions */}
      <div className="sr-only">
        Use left and right arrow keys to change slides. Press space to{" "}
        {isPlaying ? "pause" : "play"}. Press Escape to stop autoplay. Showing
        slide {current + 1} of {slides.length}.
      </div>
    </section>
  );
}
