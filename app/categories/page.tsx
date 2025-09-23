// app/categories/page.tsx
import Link from "next/link";

export default function CategoriesPage() {
  const categories = [
    {
      name: "Vibrators",
      slug: "vibrators",
      description: "Vibrating pleasure devices",
      subcategories: ["Clitoral", "G-Spot", "Rabbit", "Wand", "Bullet", "Remote Control"]
    },
    {
      name: "Dildos & Toys", 
      slug: "dildos-toys",
      description: "Non-vibrating intimate toys",
      subcategories: ["Realistic", "Non-realistic", "Double-ended", "Suction-cup", "Glass/Metal"]
    },
    {
      name: "Men's Toys",
      slug: "mens-toys", 
      description: "Pleasure products for men",
      subcategories: ["Masturbators", "Pumps", "Prostate", "Cock Rings", "Training"]
    },
    {
      name: "Anal Toys",
      slug: "anal-toys",
      description: "Anal pleasure products", 
      subcategories: ["Plugs", "Beads", "Prostate", "Training Kits"]
    },
    {
      name: "Couples' Toys",
      slug: "couples-toys",
      description: "Products for couples",
      subcategories: ["Wearable", "Remote Control", "Bondage Kits", "Massage"]
    },
    {
      name: "BDSM & Fetish",
      slug: "bdsm-fetish", 
      description: "Bondage and fetish items",
      subcategories: ["Restraints", "Masks", "Gags", "Whips", "Harnesses"]
    },
    {
      name: "Lubes & Essentials",
      slug: "lubes-essentials",
      description: "Lubricants and care products",
      subcategories: ["Water-based", "Silicone-based", "Organic", "Warming", "Condoms"]
    },
    {
      name: "Lingerie & Apparel", 
      slug: "lingerie-apparel",
      description: "Intimate clothing and costumes",
      subcategories: ["Babydolls", "Corsets", "Roleplay", "Men's Wear"]
    }
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="font-serif text-4xl font-bold text-accent-gold mb-4">
          Product Categories
        </h1>
        <p className="text-lg opacity-80">
          Explore our carefully curated collection of premium adult products.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <div key={category.slug} className="product-card p-6">
            <h2 className="font-serif text-xl font-semibold text-accent-gold mb-3">
              {category.name}
            </h2>
            <p className="text-sm opacity-80 mb-4">
              {category.description}
            </p>
            <div className="space-y-2 mb-6">
              {category.subcategories.map((sub) => (
                <Link 
                  key={sub}
                  href={`/categories/${category.slug}/${sub.toLowerCase().replace(/\s+/g, '-')}`}
                  className="block text-sm hover:text-accent-gold transition-colors"
                >
                  → {sub}
                </Link>
              ))}
            </div>
            <Link 
              href={`/categories/${category.slug}`}
              className="luxury-button-outline w-full text-center block py-2"
            >
              Shop {category.name}
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link 
          href="/store"
          className="luxury-button px-8 py-4 text-lg"
        >
          Browse All Products
        </Link>
      </div>
    </div>
  );
}