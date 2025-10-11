// data/categories.ts

export type Subcat = { name: string };

export type Category = {
  key: string;
  name: string;
  desc: string;
  count: number;
  image: string;
  sub: Subcat[];
};

export const CATEGORIES: Category[] = [
  {
    key: "wellness",
    name: "Wellness & Massage",
    desc: "Oils, candles, wands & spa-grade massage tools.",
    count: 214,
    image: "/demo/cat/wellness.jpg",
    sub: [
      { name: "Massage Oils" },
      { name: "Candles" },
      { name: "Massage Wands" },
      { name: "Nuru Gel" },
      { name: "Reflex Tools" },
    ],
  },
  {
    key: "essentials",
    name: "Essentials",
    desc: "Condoms, lubes, wipes, discreet pouches & kits.",
    count: 207,
    image: "/demo/cat/essentials.jpg",
    sub: [
      { name: "Condoms" },
      { name: "Water-Based Lubes" },
      { name: "Silicone Lubes" },
      { name: "Toy Cleaner" },
      { name: "Travel Kits" },
    ],
  },
  {
    key: "couples",
    name: "Couples",
    desc: "Playful picks designed to spark shared moments.",
    count: 121,
    image: "/demo/cat/couples.jpg",
    sub: [
      { name: "Vibrating Rings" },
      { name: "Remote-Control Toys" },
      { name: "Bonding Games" },
      { name: "Date Night Kits" },
    ],
  },
  {
    key: "personal",
    name: "Personal Care",
    desc: "Skin-safe cleansers, pH care & after-care balms.",
    count: 134,
    image: "/demo/cat/personal.jpg",
    sub: [
      { name: "Derm-Safe Wash" },
      { name: "pH Care" },
      { name: "After-care Balms" },
    ],
  },
  {
    key: "smart",
    name: "Smart Devices",
    desc: "App-connected gear with discreet modes.",
    count: 73,
    image: "/demo/cat/smart.jpg",
    sub: [
      { name: "App Vibrators" },
      { name: "Wearables" },
      { name: "Remote-Control" },
    ],
  },
  {
    key: "gift",
    name: "Gift Sets",
    desc: "Beautifully boxed bundles for every mood.",
    count: 88,
    image: "/demo/cat/gift.jpg",
    sub: [
      { name: "Starter Kits" },
      { name: "Anniversary Sets" },
      { name: "Mini Samplers" },
    ],
  },
  {
    key: "intimates",
    name: "Intimates & Lingerie",
    desc: "Silhouettes and textures curated for confidence.",
    count: 162,
    image: "/demo/cat/lingerie.jpg",
    sub: [
      { name: "Teddies" },
      { name: "Bodysuits" },
      { name: "Robes" },
      { name: "Stockings" },
    ],
  },
  // Added per our earlier spec
  {
    key: "adult-toys",
    name: "Adult Toys",
    desc: "From beginner-friendly to pro-grade toys.",
    count: 245,
    image: "/demo/cat/toys.jpg",
    sub: [
      { name: "Prostate Massagers" },
      { name: "Penis Rings" },
      { name: "Remote-Controlled Vibrators" },
      { name: "App-Controlled Toys" },
    ],
  },
];

// Convenience map for server pages
export const REGISTRY: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
);
