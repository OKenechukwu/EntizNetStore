'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

type Props = { kind: 'seller' | 'business' };

export default function CapabilityApplicationForm({ kind }: Props) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [subtype, setSubtype] = useState(kind === 'seller' ? 'individual' : 'brand');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSeller = kind === 'seller';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(isSeller ? 'Storefront name is required.' : 'Business display name is required.');
      return;
    }

    setBusy(true);
    try {
      const body = isSeller
        ? { storefront_name: name.trim(), business_type: subtype }
        : { display_name: name.trim(), business_kind: subtype };
      const response = await fetch(`/api/onboarding/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to complete onboarding');

      await refreshProfile();
      router.replace('/dashboard/verification');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete onboarding');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">
          {isSeller ? 'Storefront name' : 'Business display name'}
        </label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          required
          className="w-full rounded-lg border border-white/10 bg-background px-4 py-3"
          placeholder={isSeller ? 'Your store name' : 'Your brand or company name'}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          {isSeller ? 'Seller type' : 'Business type'}
        </label>
        <select
          value={subtype}
          onChange={(event) => setSubtype(event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-background px-4 py-3"
        >
          {isSeller ? (
            <>
              <option value="individual">Individual seller</option>
              <option value="business">Registered business</option>
              <option value="creator">Creator / maker</option>
            </>
          ) : (
            <>
              <option value="brand">Brand</option>
              <option value="supplier">Supplier</option>
              <option value="manufacturer">Manufacturer</option>
              <option value="distributor">Distributor</option>
              <option value="wholesaler">Wholesaler</option>
              <option value="retailer">Retail business</option>
              <option value="other">Other business</option>
            </>
          )}
        </select>
      </div>

      <div className="rounded-lg border border-accent-gold/20 bg-accent-gold/5 p-4 text-sm opacity-90">
        {isSeller
          ? 'Your Buyer capability stays active. Seller verification starts in pending state and the next step is secure KYC document submission.'
          : 'Your BSM onboarding keeps Buyer active and provisions Seller + Business capabilities on the same identity. The next step is business-grade KYC before public product publishing.'}
      </div>

      {error && <p className="text-sm text-red-500" role="alert">{error}</p>}

      <button type="submit" disabled={busy} className="luxury-button w-full py-3 disabled:opacity-60">
        {busy
          ? 'Creating capability…'
          : isSeller
            ? 'Continue to seller verification'
            : 'Continue to business verification'}
      </button>
    </form>
  );
}
