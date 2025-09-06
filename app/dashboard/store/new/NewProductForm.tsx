'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase/client';

export default function NewProductForm() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('You must be signed in to create a product');
        return;
      }

      const priceNumber = parseFloat(price);
      if (isNaN(priceNumber)) {
        setError('Price must be a valid number');
        return;
      }

      const { error: insertError } = await supabase
        .from('products')
        .insert({
          owner: user.id,
          title: title.trim(),
          description: description.trim() || null,
          price: priceNumber,
          images: []
        });

      if (insertError) {
        setError(`Failed to create product: ${insertError.message}`);
      } else {
        router.push('/dashboard/store');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Title *
        </label>
        <input
          type="text"
          id="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="Enter product title"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="Enter product description (optional)"
        />
      </div>

      <div>
        <label htmlFor="price" className="block text-sm font-medium text-gray-700">
          Price *
        </label>
        <input
          type="number"
          id="price"
          required
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="0.00"
        />
      </div>

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Product'}
        </button>
        
        <button
          type="button"
          onClick={() => router.push('/dashboard/store')}
          className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}