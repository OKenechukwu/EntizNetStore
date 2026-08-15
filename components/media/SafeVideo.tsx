"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  src: string; // /videos/... .mp4
  fallbackImg?: string; // shown if video errors or 416s
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  poster?: string; // optional poster image
  controls?: boolean;
  preload?: "none" | "metadata" | "auto";
  onClick?: () => void;
  onError?: () => void;
  style?: React.CSSProperties;
};

export default function SafeVideo({
  src,
  fallbackImg = "/images/video-fallback.jpg",
  className,
  autoPlay = true,
  loop = true,
  muted = true,
  playsInline = true,
  poster,
  controls = false,
  preload = "none",
  onClick,
  onError: onErrorProp,
  style,
}: Props) {
  const [failed, setFailed] = useState(false);
  const [triedOnce, setTriedOnce] = useState(false);
  const vidRef = useRef<HTMLVideoElement>(null);

  // Try to play only once (prevents retry storms on bad demo files)
  useEffect(() => {
    if (failed || triedOnce || !autoPlay) return;
    const v = vidRef.current;
    setTriedOnce(true);
    // Kick off a quiet play attempt; ignore promise rejections
    v?.play?.().catch(() => {
      setFailed(true);
    });
  }, [failed, triedOnce, autoPlay]);

  const onError = () => {
    setFailed(true);
    onErrorProp?.();
  };

  if (failed) {
    return (
      <img
        src={poster || fallbackImg}
        alt="video fallback"
        className={className}
        onClick={onClick}
        style={style}
        loading="lazy"
      />
    );
  }

  return (
    <video
      ref={vidRef}
      className={className}
      src={src}
      onError={onError}
      onStalled={onError}
      onAbort={onError}
      muted={muted}
      loop={loop}
      playsInline={playsInline}
      autoPlay={autoPlay}
      controls={controls}
      preload={preload}
      poster={poster}
    />
  );
}
