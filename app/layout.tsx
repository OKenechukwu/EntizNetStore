// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EntizNet",
  description: "EntizNet marketplace",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-white`}>
        <header className="border-b bg-white/70 backdrop-blur sticky top-0 z-50">
          <nav className="mx-auto max-w-5xl flex items-center gap-4 p-3">
            <Link href="/" className="font-semibold">
              Home
            </Link>
            <Link href="/store" className="text-sky-600 hover:underline">
              Store
            </Link>
          </nav>
        </header>

        <main className="mx-auto max-w-5xl p-6">{children}</main>
      </body>
    </html>
  );
}
