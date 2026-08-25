"use client";

import { useEffect, useRef, useState } from "react";

export default function AgeGate({ children }: { children: React.ReactNode }) {
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const verified = localStorage.getItem("entiznet-age-verified") === "true";
    setIsVerified(verified);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isVerified === false) {
      confirmButtonRef.current?.focus();
    }
  }, [mounted, isVerified]);

  const handleVerifyAge = (isAdult: boolean) => {
    if (isAdult) {
      localStorage.setItem("entiznet-age-verified", "true");
      setIsVerified(true);
    } else {
      window.location.href = "https://www.google.com";
    }
  };

  if (!mounted) {
    return null;
  }

  if (!isVerified) {
    return (
      <div className="age-gate-overlay box-border overflow-x-hidden p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="age-gate-title"
          aria-describedby="age-gate-description"
          className="glass-card box-border max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] min-w-0 max-w-md overflow-y-auto p-5 text-center animate-fade-in sm:p-8"
        >
          <div className="mb-6">
            <h1 className="font-serif text-3xl font-bold text-accent-gold mb-2">
              EntizNet Store
            </h1>
            <div className="mx-auto mb-6 h-0.5 w-16 bg-accent-gold" aria-hidden="true" />
          </div>

          <h2 id="age-gate-title" className="mb-4 font-serif text-2xl">
            Age Verification Required
          </h2>

          <p id="age-gate-description" className="mb-6 text-sm leading-relaxed opacity-80">
            This website contains adult content and is intended for adults only.
            You must be 18 years or older to access this site.
          </p>

          <p className="mb-8 text-sm font-medium">
            Are you 18 years of age or older?
          </p>

          <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
            <button
              ref={confirmButtonRef}
              type="button"
              onClick={() => handleVerifyAge(true)}
              className="luxury-button min-h-11 w-full px-6 py-3 sm:w-auto"
            >
              Yes, I am 18+
            </button>
            <button
              type="button"
              onClick={() => handleVerifyAge(false)}
              className="luxury-button-outline min-h-11 w-full px-6 py-3 sm:w-auto"
            >
              No, I am under 18
            </button>
          </div>

          <p className="mt-6 text-xs opacity-60">
            By clicking &quot;Yes&quot;, you certify that you are 18+ years of age and agree
            to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
