"use client";

import { useState, useEffect } from "react";

export default function AgeGate({ children }: { children: React.ReactNode }) {
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Check if user has already verified their age
    const verified = localStorage.getItem("entiznet-age-verified") === "true";
    setIsVerified(verified);
    setMounted(true);
  }, []);

  const handleVerifyAge = (isAdult: boolean) => {
    if (isAdult) {
      localStorage.setItem("entiznet-age-verified", "true");
      setIsVerified(true);
    } else {
      // Redirect away from the site
      window.location.href = "https://www.google.com";
    }
  };

  // Don't render anything until mounted to prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  // Show age gate if not verified
  if (!isVerified) {
    return (
      <div className="age-gate-overlay">
        <div className="glass-card p-8 max-w-md w-full mx-4 text-center animate-fade-in">
          <div className="mb-6">
            <h1 className="font-serif font-bold text-3xl text-accent-gold mb-2">
              EntizNet Store
            </h1>
            <div className="w-16 h-0.5 bg-accent-gold mx-auto mb-6"></div>
          </div>

          <h2 className="font-serif text-2xl mb-4">Age Verification Required</h2>
          
          <p className="text-sm opacity-80 mb-6 leading-relaxed">
            This website contains adult content and is intended for adults only. 
            You must be 18 years or older to access this site.
          </p>

          <p className="text-sm font-medium mb-8">
            Are you 18 years of age or older?
          </p>

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => handleVerifyAge(true)}
              className="luxury-button px-8 py-3"
            >
              Yes, I am 18+
            </button>
            <button
              onClick={() => handleVerifyAge(false)}
              className="luxury-button-outline px-8 py-3"
            >
              No, I am under 18
            </button>
          </div>

          <p className="text-xs opacity-60 mt-6">
            By clicking "Yes", you certify that you are 18+ years of age and agree 
            to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}