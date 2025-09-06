import { redirect } from 'next/navigation';
import { createServerSupabase } from '../../../../../lib/supabase/server';
import EditProductForm from './EditProductForm';

type Product = {
  id: string;
  title: string | null;
  description: string | null;
  price: number | null;
  owner: string;
};

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    redirect('/auth/sign-in');
  }

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, title, description, price, owner')
    .eq('id', params.id)
    .eq('owner', session.user.id)
    .single();

  if (productError || !product) {
    redirect('/dashboard/store');
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit Product</h1>
        <p className="text-gray-600 mt-2">Update your product information</p>
      </div>
      
      <EditProductForm product={product as Product} />
    </div>
  );
}