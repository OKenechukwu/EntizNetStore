// app/internal/layout.tsx
import { notFound } from "next/navigation";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isDev = process.env.NODE_ENV !== "production";
  const open = process.env.INTERNAL_OPEN === "true"; // <- changed name

  if (!isDev && !open) {
    notFound();
  }

  return <>{children}</>;
}
