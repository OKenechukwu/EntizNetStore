// app/on-sale/page.tsx
import Link from "next/link";
import { getSaleProducts } from "@/lib/database";

export default async function OnSalePage() {
  const saleProducts = await getSaleProducts(12);
  
  // Transform data to match component expectations
  const transformedProducts = saleProducts.map(product => {
    const discount = product.compare_at_price ? 
      Math.round(((product.compare_at_price - product.base_price) / product.compare_at_price) * 100) : 0;
    
    return {
      id: product.id,
      title: product.title,
      price: product.base_price,
      originalPrice: product.compare_at_price || product.base_price * 1.3,
      discount,
      rating: 4.7, // Will come from reviews later
      reviews: 0, // Will come from reviews later
      category: "Premium",
      image: "/placeholder-product.jpg",
      saleEnd: "2025-10-01"
    };
  });
  
  // If no products, show sample data for demo
  const displayProducts = transformedProducts.length > 0 ? transformedProducts : [
    {
      id: "1",
      title: "Deluxe Couples Collection",
      price: 149.99,
      originalPrice: 249.99,
      discount: 40,
      rating: 4.8,
      reviews: 72,
      category: "Couples' Toys",
      image: "/placeholder-product.jpg",
      saleEnd: "2025-10-01"
    },
    {
      id: "2",
      title: "Premium Vibrator Set",
      price: 199.99,
      originalPrice: 299.99,
      discount: 33,
      rating: 4.9,
      reviews: 145,
      category: "Vibrators",
      image: "/placeholder-product.jpg",
      saleEnd: "2025-10-01"
    },
    {
      id: "3", 
      title: "Luxury Lingerie Bundle",
      price: 89.99,
      originalPrice: 159.99,
      discount: 44,
      rating: 4.7,
      reviews: 98,
      category: "Lingerie & Apparel",
      image: "/placeholder-product.jpg",
      saleEnd: "2025-09-30"
    },
    {
      id: "4",
      title: "Men's Executive Kit",
      price: 179.99,
      originalPrice: 249.99,
      discount: 28,
      rating: 4.6,
      reviews: 56,
      category: "Men's Toys",
      image: "/placeholder-product.jpg",
      saleEnd: "2025-10-02"
    },
    {
      id: "5",
      title: "Sensual Essentials Pack",
      price: 69.99,
      originalPrice: 109.99,
      discount: 36,
      rating: 4.8,
      reviews: 123,
      category: "Lubes & Essentials",
      image: "/placeholder-product.jpg",
      saleEnd: "2025-10-01"
    },
    {
      id: "6",
      title: "Designer Pleasure Collection",
      price: 329.99,
      originalPrice: 499.99,
      discount: 34,
      rating: 4.9,
      reviews: 87,
      category: "Gift Sets",
      image: "/placeholder-product.jpg",
      saleEnd: "2025-09-30"
    }
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="font-serif text-4xl font-bold text-accent-gold mb-4">
          Limited Time Sales
        </h1>
        <p className="text-lg opacity-80">
          Exclusive discounts on luxury products. Premium quality at exceptional prices.
        </p>
      </div>

      {/* Sale Banner */}
      <div className="glass-card p-6 mb-8 text-center bg-gradient-to-r from-accent-gold/10 to-accent-gold/20">
        <h2 className="font-serif text-2xl font-bold text-accent-gold mb-2">
          End of Season Sale
        </h2>
        <p className="text-lg mb-4">
          Up to 50% off selected luxury items • Limited time only
        </p>
        <div className="text-sm opacity-80">
          Sale ends in: <span className="font-semibold text-accent-gold">7 days</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayProducts.map((product) => (
          <div key={product.id} className="product-card p-0 overflow-hidden relative">
            {/* Discount Badge */}
            <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold z-10">
              -{product.discount}%
            </div>

            {/* Product Image */}
            <div className="aspect-square bg-gradient-to-br from-charcoal to-primary-black relative">
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

              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl font-bold text-accent-gold">
                  ${product.price}
                </span>
                <span className="text-sm opacity-60 line-through">
                  ${product.originalPrice}
                </span>
              </div>

              <div className="text-sm text-green-400 mb-4">
                Save ${(product.originalPrice - product.price).toFixed(2)}
              </div>

              <div className="text-xs opacity-60 mb-4">
                Sale ends: {new Date(product.saleEnd).toLocaleDateString()}
              </div>

              <Link
                href={`/store/${product.id}`}
                className="luxury-button w-full text-center block py-2 bg-accent-gold text-primary-black hover:bg-opacity-90 transition-colors"
              >
                Buy Now
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <div className="glass-card p-8 max-w-2xl mx-auto">
          <h2 className="font-serif text-2xl font-bold text-accent-gold mb-4">
            Don't Miss Out
          </h2>
          <p className="mb-6 opacity-80">
            These luxury items rarely go on sale. Add to cart now to secure these exclusive prices.
          </p>
          <Link 
            href="/store"
            className="luxury-button px-8 py-3"
          >
            Browse All Products
          </Link>
        </div>
      </div>
    </div>
  );
}