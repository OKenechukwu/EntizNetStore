import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Globe2,
  Link2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Download the EntizNetStore App",
  description:
    "Shop EntizNetStore on the mobile web today and follow the rollout of our native iOS and Android marketplace apps.",
};

const nativeBenefits = [
  {
    icon: ShieldCheck,
    title: "Secure native sessions",
    description:
      "Device-appropriate authentication and protected session storage instead of wrapping the website in an app shell.",
  },
  {
    icon: BellRing,
    title: "Native notifications",
    description:
      "Order, Seller and account notifications designed around mobile push delivery and user consent.",
  },
  {
    icon: Link2,
    title: "Deep-linked marketplace flows",
    description:
      "Open products, stores, orders and EntizNet entry points directly in the correct native screen.",
  },
];

export default function AppsPage() {
  return (
    <div className="min-h-[calc(100vh-7rem)] bg-background text-foreground">
      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 md:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <Smartphone className="h-7 w-7 text-brand-secondary" aria-hidden="true" />
          </div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-brand-secondary">
            EntizNetStore everywhere
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Shop on the web now. Native apps are next.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-foreground/70 sm:text-lg">
            The responsive EntizNetStore web marketplace launches first. Our iOS and
            Android apps will follow as true native marketplace clients built for
            their respective store-review requirements—not as web wrappers.
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-secondary px-6 py-3 text-sm font-bold text-primary-black transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Globe2 className="h-4 w-4" aria-hidden="true" />
              Shop on the web
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <span className="text-sm text-foreground/60">
              Works on modern phone, tablet and desktop browsers.
            </span>
          </div>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-brand-secondary">iPhone & iPad</p>
                <h2 className="mt-1 text-2xl font-bold">EntizNetStore for iOS</h2>
              </div>
              <Smartphone className="h-7 w-7 text-foreground/70" aria-hidden="true" />
            </div>
            <p className="mt-4 leading-7 text-foreground/70">
              Planned immediately after the public web launch reaches its production
              gates. The native build will be prepared specifically for Apple review.
            </p>
            <div
              className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-foreground/55"
              aria-label="iOS App Store release coming soon"
            >
              App Store — Coming soon
            </div>
          </article>

          <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-brand-secondary">Android phones & tablets</p>
                <h2 className="mt-1 text-2xl font-bold">EntizNetStore for Android</h2>
              </div>
              <Smartphone className="h-7 w-7 text-foreground/70" aria-hidden="true" />
            </div>
            <p className="mt-4 leading-7 text-foreground/70">
              Planned immediately after the public web launch reaches its production
              gates. The native build will be prepared specifically for Google Play review.
            </p>
            <div
              className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-foreground/55"
              aria-label="Google Play release coming soon"
            >
              Google Play — Coming soon
            </div>
          </article>
        </div>

        <section className="mt-14 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 md:p-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-secondary">
              Native means native
            </p>
            <h2 className="mt-3 text-3xl font-bold">Built for mobile, not wrapped from the web</h2>
            <p className="mt-4 leading-7 text-foreground/70">
              Web and mobile will share trusted backend contracts and commerce rules,
              while the mobile experience is implemented in React Native + TypeScript.
              App Store and Google Play policy review will be treated as dedicated release
              gates before either download badge becomes an external store link.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {nativeBenefits.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-background/50 p-5">
                <Icon className="h-6 w-6 text-brand-secondary" aria-hidden="true" />
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-foreground/65">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
