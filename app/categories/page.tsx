// app/categories/page.tsx
import Link from "next/link";
import { getCategories, getSubcategories } from "@/lib/database";

export default async function CategoriesPage() {
  // Get all main categories (no parent)
  const allCategories = await getCategories();
  const mainCategories = allCategories.filter(cat => !cat.parent_id);
  
  // Get subcategories for each main category
  const categoriesWithSubs = await Promise.all(
    mainCategories.map(async (category) => {
      const subcategories = await getSubcategories(category.id);
      return {
        ...category,
        subcategories
      };
    })
  );

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
        {categoriesWithSubs.map((category) => (
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
                  key={sub.id}
                  href={`/categories/${sub.slug}`}
                  className="block text-sm hover:text-accent-gold transition-colors"
                >
                  → {sub.name}
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