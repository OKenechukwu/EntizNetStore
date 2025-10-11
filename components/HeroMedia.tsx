"use client";
import { useState } from "react";
import Image from "next/image";

export default function HeroMedia() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="relative overflow-hidden rounded-2xl glass-card">
        <Image
          src="/images/hero/wellness.jpg" // ensure this exists (public/images/hero/wellness.jpg)
          alt="Luxury Adult Wellness"
          width={1600}
          height={900}
          className="w-full h-auto"
          priority
        />
      </div>
    );
  }

  return (
    <video
      className="w-full rounded-2xl shadow-glow"
      poster="/images/hero/wellness-poster.jpg" // optional; add if you have it
      preload="none" // avoid range preloads → no 416 spam
      playsInline
      muted
      autoPlay
      loop
      onError={() => setFailed(true)}
      src="/videos/hero/wellness-experience.mp4" // your current path
    />
  );
}
