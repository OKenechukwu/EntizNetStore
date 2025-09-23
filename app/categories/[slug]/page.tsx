// app/categories/[slug]/page.tsx
import Link from "next/link";
import { getCategoryBySlug, getProducts, getSubcategories } from "@/lib/database";
import { notFound } from "next/navigation";

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const category = await getCategoryBySlug(params.slug);
  
  if (!category) {
    notFound();
  }
  
  // Get subcategories if this is a parent category
  const subcategories = await getSubcategories(category.id);
  
  // Get products in this category
  const products = await getProducts({ 
    category: category.slug,
    limit: 12 
  });
  
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <nav className="text-sm mb-4">
          <Link href="/categories" className="hover:text-accent-gold transition-colors">
            Categories
          </Link>
          <span className="mx-2 opacity-60">→</span>
          <span className="text-accent-gold">{category.name}</span>
        </nav>
        
        <h1 className="font-serif text-4xl font-bold text-accent-gold mb-4">
          {category.name}
        </h1>
        {category.description && (
          <p className="text-lg opacity-80">
            {category.description}
          </p>
        )}
      </div>
      
      {/* Subcategories */}
      {subcategories.length > 0 && (
        <div className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6">Browse by Type</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {subcategories.map((subcategory) => (
              <Link
                key={subcategory.id}
                href={`/categories/${subcategory.slug}`}
                className="glass-card p-4 text-center hover:bg-accent-gold/10 transition-colors group"
              >
                <h3 className="font-semibold group-hover:text-accent-gold transition-colors">
                  {subcategory.name}
                </h3>
                {subcategory.description && (
                  <p className="text-sm opacity-70 mt-1">
                    {subcategory.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
      
      {/* Products */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-2xl font-semibold">
            {category.name} Products
          </h2>
          <div className="flex items-center gap-4 text-sm">
            <span className="opacity-60">{products.length} products</span>
            <select className="bg-transparent border border-accent-gold/30 rounded px-3 py-1">
              <option>Sort by Featured</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
              <option>Newest First</option>
            </select>
          </div>
        </div>
        
        {products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <div key={product.id} className="product-card p-0 overflow-hidden">
                {/* Product Image */}
                <div className="aspect-square bg-gradient-to-br from-charcoal to-primary-black relative">
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
            <h3 className="font-serif text-xl font-semibold mb-2">Coming Soon</h3>
            <p className="opacity-80 mb-6">
              We're curating premium products for this category. Check back soon for luxury {category.name.toLowerCase()}.
            </p>
            <Link 
              href="/categories"
              className="luxury-button px-6 py-3"
            >
              Browse Other Categories
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}