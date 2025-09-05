'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';

export default function SignOutPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    setLoading(true);
    
    try {
      await supabase.auth.signOut();
      router.replace('/store');
    } catch (err) {
      console.error('Error signing out:', err);
      // Still redirect even if there's an error
      router.replace('/store');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Sign out
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Are you sure you want to sign out?
          </p>
        </div>
        <div>
          <button
            onClick={handleSignOut}
            disabled={loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            {loading ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  );
}