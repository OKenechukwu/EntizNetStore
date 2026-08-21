import FeaturedSection from "@/components/home/FeaturedSection";
import HeroSlider from "@/components/hero/HeroSlider";
import CategoriesRow from "@/components/home/CategoriesRow";
import { getFeaturedProducts } from "@/lib/data/products";

export default async function HomePage() {
  const products = await getFeaturedProducts(12, "entiznetstore");
  const items = products.map((product) => ({
    id: product.id,
    title: product.title,
    price: product.basePrice,
    rating: product.rating,
    href: `/products/${product.slug}`,
    image: product.images[0]?.url,
  }));

  return (
    <div className="w-full">
      <HeroSlider />
      <CategoriesRow />

      <div className="pb-12">
        <FeaturedSection
          titleKey="home.featuredProducts"
          titleFallback="Featured Products"
          items={items}
          viewAllHref="/store"
        />
      </div>
    </div>
  );
}
