// app/popular/page.tsx
import Link from "next/link";

export default function PopularPage() {
  // Mock popular products data
  const popularProducts = [
    {
      id: "1",
      title: "Luxury Silk Collection Set",
      price: 299.99,
      originalPrice: 399.99,
      rating: 4.9,
      reviews: 128,
      category: "Gift Sets",
      image: "/placeholder-product.jpg",
      badge: "Bestseller"
    },
    {
      id: "2", 
      title: "Premium Couples Experience Kit",
      price: 189.99,
      originalPrice: null,
      rating: 4.8,
      reviews: 94,
      category: "Couples' Toys",
      image: "/placeholder-product.jpg",
      badge: "Editor's Choice"
    },
    {
      id: "3",
      title: "Discreet Luxury Vibrator",
      price: 159.99,
      originalPrice: 199.99,
      rating: 4.7,
      reviews: 203,
      category: "Vibrators", 
      image: "/placeholder-product.jpg",
      badge: "Most Reviewed"
    },
    {
      id: "4",
      title: "Gold-Infused Intimate Care Set",
      price: 89.99,
      originalPrice: null,
      rating: 4.9,
      reviews: 67,
      category: "Lubes & Essentials",
      image: "/placeholder-product.jpg",
      badge: "New Arrival"
    },
    {
      id: "5",
      title: "Designer Lingerie Collection",
      price: 129.99,
      originalPrice: 179.99, 
      rating: 4.6,
      reviews: 156,
      category: "Lingerie & Apparel",
      image: "/placeholder-product.jpg",
      badge: "Trending"
    },
    {
      id: "6",
      title: "Executive Men's Pleasure Kit",
      price: 249.99,
      originalPrice: null,
      rating: 4.8,
      reviews: 89,
      category: "Men's Toys",
      image: "/placeholder-product.jpg", 
      badge: "Premium"
    }
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="font-serif text-4xl font-bold text-accent-gold mb-4">
          Popular Products
        </h1>
        <p className="text-lg opacity-80">
          Discover what our community loves most - the highest-rated and most-purchased luxury items.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {popularProducts.map((product) => (
          <div key={product.id} className="product-card p-0 overflow-hidden">
            {/* Product Image */}
            <div className="aspect-square bg-gradient-to-br from-charcoal to-primary-black relative">
              {product.badge && (
                <div className="absolute top-4 left-4 bg-accent-gold text-primary-black px-3 py-1 rounded-full text-xs font-semibold z-10">
                  {product.badge}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-accent-gold font-serif text-lg opacity-60">
                  {product.title.split(' ').slice(0, 2).join(' ')}
                </div>
              </div>
            </div>

            {/* Product Info */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs bg-charcoal px-2 py-1 rounded-full opacity-60">
                  {product.category}
                </span>
                <div className="flex items-center gap-1">
                  <div className="flex text-accent-gold">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className={`w-3 h-3 ${i < Math.floor(product.rating) ? 'text-accent-gold' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-xs opacity-60">({product.reviews})</span>
                </div>
              </div>

              <h3 className="font-serif text-lg font-semibold mb-3 line-clamp-2">
                {product.title}
              </h3>

              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg font-semibold text-accent-gold">
                  ${product.price}
                </span>
                {product.originalPrice && (
                  <span className="text-sm opacity-60 line-through">
                    ${product.originalPrice}
                  </span>
                )}
              </div>

              <Link
                href={`/store/${product.id}`}
                className="luxury-button-outline w-full text-center block py-2 hover:bg-accent-gold hover:text-primary-black transition-colors"
              >
                View Details
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link 
          href="/store"
          className="luxury-button px-8 py-4 text-lg"
        >
          View All Products
        </Link>
      </div>
    </div>
  );
}