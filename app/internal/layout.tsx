// app/internal/layout.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Ensure this gate is evaluated per-request (no caching)
export const revalidate = 0;

export default function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate: only available in development unless explicitly opened in prod
  const isDev = process.env.NODE_ENV !== "production";
  const open = process.env.INTERNAL_OPEN === "true";

  if (!isDev && !open) {
    notFound();
  }

  return <>{children}</>;
}
