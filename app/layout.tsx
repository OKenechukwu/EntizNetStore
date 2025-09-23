// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { LayoutContent } from "./layout-content";

export const metadata: Metadata = {
  title: "EntizNet Store - Luxury Adult Marketplace",
  description: "Premium adult products and experiences. Discrete, luxury, authentic.",
  keywords: "adult marketplace, luxury products, discrete shopping",
  robots: "noindex, nofollow", // Adult content - no indexing
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <LayoutContent>{children}</LayoutContent>
      </body>
    </html>
  );
}
