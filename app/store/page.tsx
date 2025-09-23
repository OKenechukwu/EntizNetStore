// app/store/page.tsx
import Link from "next/link";
import { getProducts, getCategories } from "@/lib/database";

export default async function StorePage() {
  // Get featured products
  const featuredProducts = await getProducts({ limit: 16 });
  const categories = await getCategories();
  const mainCategories = categories.filter(cat => !cat.parent_id);
  
  return (
    <div className="animate-fade-in">
      <div className="mb-12">
        <h1 className="font-serif text-4xl font-bold text-accent-gold mb-4">
          Premium Store
        </h1>
        <p className="text-lg opacity-80">
          Discover our curated collection of luxury adult products from verified brands.
        </p>
      </div>
      
      {/* Quick Category Navigation */}
      <div className="mb-12">
        <h2 className="font-serif text-2xl font-semibold mb-6">Shop by Category</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {mainCategories.slice(0, 10).map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="glass-card p-4 text-center hover:bg-accent-gold/10 transition-colors group"
            >
              <div className="text-accent-gold mb-2 text-2xl">
                {getCategoryIcon(category.slug)}
              </div>
              <h3 className="font-semibold text-sm group-hover:text-accent-gold transition-colors">
                {category.name}
              </h3>
            </Link>
          ))}
        </div>
      </div>
      
      {/* Featured Products */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-2xl font-semibold">Featured Products</h2>
          <div className="flex items-center gap-4">
            <select className="bg-transparent border border-accent-gold/30 rounded px-3 py-1 text-sm">
              <option>All Categories</option>
              {mainCategories.map(cat => (
                <option key={cat.id} value={cat.slug}>{cat.name}</option>
              ))}
            </select>
            <select className="bg-transparent border border-accent-gold/30 rounded px-3 py-1 text-sm">
              <option>Sort by Featured</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
              <option>Newest First</option>
              <option>Most Popular</option>
            </select>
          </div>
        </div>
        
        {featuredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <div key={product.id} className="product-card p-0 overflow-hidden">
                {/* Product Image */}
                <div className="aspect-square bg-gradient-to-br from-charcoal to-primary-black relative">
                  {product.compare_at_price && (
                    <div className="absolute top-4 right-4 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold z-10">
                      Save ${(product.compare_at_price - product.base_price).toFixed(0)}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-accent-gold font-serif text-lg opacity-60">
                      {product.title.split(' ').slice(0, 2).join(' ')}
                    </div>
                  </div>
                </div>
                
                {/* Product Info */}
                <div className="p-4">
                  <h3 className="font-serif text-lg font-semibold mb-2 line-clamp-2">
                    {product.title}
                  </h3>
                  
                  <p className="text-sm opacity-80 mb-3 line-clamp-2">
                    {product.short_description || product.description}
                  </p>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg font-semibold text-accent-gold">
                      ${product.base_price}
                    </span>
                    {product.compare_at_price && (
                      <span className="text-sm opacity-60 line-through">
                        ${product.compare_at_price}
                      </span>
                    )}
                  </div>
                  
                  <Link
                    href={`/store/${product.slug}`}
                    className="luxury-button-outline w-full text-center block py-2 hover:bg-accent-gold hover:text-primary-black transition-colors"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-accent-gold mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="font-serif text-xl font-semibold mb-2">Store Coming Soon</h3>
            <p className="opacity-80 mb-6">
              We're preparing our luxury product collection. Premium adult products will be available soon.
            </p>
            <Link 
              href="/categories"
              className="luxury-button px-6 py-3"
            >
              Explore Categories
            </Link>
          </div>
        )}
      </div>
      
      {/* Call to Action for Sellers */}
      <div className="mt-16">
        <div className="glass-card p-8 text-center bg-gradient-to-r from-accent-gold/10 to-accent-gold/5">
          <h2 className="font-serif text-2xl font-bold text-accent-gold mb-4">
            Premium Brand Partnership
          </h2>
          <p className="text-lg mb-6 opacity-90 max-w-2xl mx-auto">
            Join our exclusive marketplace for luxury adult products. We partner with verified brands 
            and creators who share our commitment to quality, discretion, and premium experiences.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/seller/apply"
              className="luxury-button px-8 py-3"
            >
              Become a Partner
            </Link>
            <Link 
              href="/brands"
              className="luxury-button-outline px-8 py-3"
            >
              View Our Brands
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function getCategoryIcon(slug: string): string {
  const icons: Record<string, string> = {
    'vibrators': '✨',
    'dildos-toys': '🎯', 
    'mens-toys': '👑',
    'anal-toys': '💎',
    'couples-toys': '💫',
    'bdsm-fetish': '🔗',
    'lubes-essentials': '🧴',
    'lingerie-apparel': '👗',
    'gift-sets-bundles': '🎁',
    'digital-virtual': '📱'
  };
  return icons[slug] || '💰';
}
