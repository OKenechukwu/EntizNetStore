'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';

type Product = {
  id: string;
  title: string | null;
  price: number | null;
  images: string[] | null;
};

function formatPrice(n?: number | null) {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export default function DashboardStorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const checkUserAndLoadProducts = async () => {
      try {
        // Check if user is signed in
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          router.replace('/auth/sign-in');
          return;
        }

        // Load user's products
        const { data, error: productsError } = await supabase
          .from('products')
          .select('id, title, price, images')
          .eq('owner', user.id)
          .order('title', { ascending: true });

        if (productsError) {
          setError(`Failed to load products: ${productsError.message}`);
        } else {
          setProducts((data || []) as Product[]);
        }
      } catch (err) {
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    checkUserAndLoadProducts();
  }, [router]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">My Products</h1>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">My Products</h1>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">My Products</h1>
        <p className="text-sm text-gray-500 mb-4">You have no products yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Products</h1>
        <Link
          href="/auth/sign-out"
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          Sign out
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product) => {
              const img = Array.isArray(product.images) && product.images[0]
                ? product.images[0]
                : '/placeholder.png';
              
              return (
                <tr key={product.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex-shrink-0 h-16 w-16">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="h-16 w-16 rounded-lg object-cover"
                        src={img}
                        alt={product.title ?? 'Product'}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {product.title ?? 'Untitled product'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatPrice(product.price)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <Link
                      href={`/store/${product.id}`}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      View
                    </Link>
                    <Link
                      href={`/internal/upload-product-image?pid=${product.id}`}
                      className="text-green-600 hover:text-green-900"
                    >
                      Upload image
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}