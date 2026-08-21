import { redirect } from 'next/navigation';
import { createServerSupabase } from '../../../../../lib/supabase/server';
import ProductEditorForm from '@/components/seller/ProductEditorForm';

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  
  const { data: { user }, error: sessionError } = await supabase.auth.getUser();

  if (sessionError || !user) {
    redirect('/auth/sign-in');
  }

  // Ownership check: only the authenticated seller's own product is loaded.
  // RLS remains the final database security boundary.
  const [productResult, sellerResult, categoriesResult] = await Promise.all([
    supabase
      .from('products')
      .select('id, title, description, base_price, compare_at_price, status, seller_id, product_media(url, position), product_variants(id, title, sku, price, inventory_quantity, is_active, position), product_categories(category_id)')
      .eq('id', params.id)
      .eq('seller_id', user.id)
      .single(),
    supabase.from('profiles_seller').select('verification_status').eq('id', user.id).maybeSingle(),
    supabase.from('categories').select('id, name').eq('is_active', true).order('name'),
  ]);

  const product = productResult.data;

  if (productResult.error || !product || !sellerResult.data) {
    redirect('/dashboard/store');
  }

  const media = [...(product.product_media ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const variants = [...(product.product_variants ?? [])]
    .filter((variant) => variant.is_active)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit Product</h1>
        <p className="text-gray-600 mt-2">Update your product information</p>
      </div>
      
      <ProductEditorForm
        categories={categoriesResult.data ?? []}
        sellerVerified={sellerResult.data.verification_status === 'verified'}
        initial={{
          id: product.id,
          title: product.title,
          description: product.description ?? '',
          basePrice: Number(product.base_price),
          compareAtPrice: product.compare_at_price == null ? null : Number(product.compare_at_price),
          status: product.status === 'active' ? 'active' : 'draft',
          categoryIds: (product.product_categories ?? []).map((item) => item.category_id),
          mediaUrls: media.map((item) => item.url),
          variants: variants.length
            ? variants.map((variant) => ({
                id: variant.id,
                title: variant.title,
                sku: variant.sku ?? '',
                price: Number(variant.price),
                inventoryQuantity: Number(variant.inventory_quantity ?? 0),
              }))
            : [{ title: 'Default', sku: '', price: Number(product.base_price), inventoryQuantity: 0 }],
        }}
      />
    </div>
  );
}
