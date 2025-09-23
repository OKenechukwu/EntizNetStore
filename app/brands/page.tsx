// app/brands/page.tsx
import Link from "next/link";

export default function BrandsPage() {
  const brands = [
    {
      name: "Luxe Intimates",
      slug: "luxe-intimates",
      description: "Premium designer intimate products",
      image: "/placeholder-brand.jpg",
      verified: true,
      productCount: 45
    },
    {
      name: "Velvet Touch",
      slug: "velvet-touch", 
      description: "Soft luxury adult accessories",
      image: "/placeholder-brand.jpg",
      verified: true,
      productCount: 32
    },
    {
      name: "Discreet Desires",
      slug: "discreet-desires",
      description: "Elegant and sophisticated pleasure products", 
      image: "/placeholder-brand.jpg",
      verified: true,
      productCount: 58
    },
    {
      name: "Golden Touch",
      slug: "golden-touch",
      description: "High-end luxury intimate experiences",
      image: "/placeholder-brand.jpg", 
      verified: true,
      productCount: 27
    },
    {
      name: "Midnight Collection",
      slug: "midnight-collection",
      description: "Exclusive after-dark essentials",
      image: "/placeholder-brand.jpg",
      verified: false,
      productCount: 19
    },
    {
      name: "Silken Dreams",
      slug: "silken-dreams",
      description: "Premium silk and satin intimate wear",
      image: "/placeholder-brand.jpg",
      verified: true,
      productCount: 41
    }
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="font-serif text-4xl font-bold text-accent-gold mb-4">
          Featured Brands & Creators
        </h1>
        <p className="text-lg opacity-80">
          Discover premium products from our verified luxury brands and independent creators.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {brands.map((brand) => (
          <div key={brand.slug} className="product-card p-6">
            <div className="aspect-square bg-gradient-to-br from-charcoal to-primary-black rounded-lg mb-4 flex items-center justify-center">
              <div className="text-accent-gold font-serif text-2xl font-bold">
                {brand.name.split(' ').map(word => word[0]).join('')}
              </div>
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              <h2 className="font-serif text-xl font-semibold">
                {brand.name}
              </h2>
              {brand.verified && (
                <div className="w-5 h-5 rounded-full bg-accent-gold flex items-center justify-center">
                  <svg className="w-3 h-3 text-primary-black" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            
            <p className="text-sm opacity-80 mb-4">
              {brand.description}
            </p>
            
            <div className="flex items-center justify-between text-sm opacity-60 mb-4">
              <span>{brand.productCount} products</span>
              {brand.verified && <span>✓ Verified</span>}
            </div>
            
            <Link 
              href={`/brands/${brand.slug}`}
              className="luxury-button-outline w-full text-center block py-2"
            >
              View Products
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <div className="glass-card p-8 max-w-2xl mx-auto">
          <h2 className="font-serif text-2xl font-bold text-accent-gold mb-4">
            Become a Brand Partner
          </h2>
          <p className="mb-6 opacity-80">
            Join our exclusive marketplace and reach discerning customers who value quality and discretion.
          </p>
          <Link 
            href="/seller/apply"
            className="luxury-button px-8 py-3"
          >
            Apply to Sell
          </Link>
        </div>
      </div>
    </div>
  );
}