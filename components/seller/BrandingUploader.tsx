'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

type Props = {
  initialLogo: string | null;
  initialBanner: string | null;
};

type Slot = 'logo' | 'banner';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export default function BrandingUploader({ initialLogo, initialBanner }: Props) {
  const { refreshProfile } = useAuth();
  const [logo, setLogo] = useState(initialLogo);
  const [banner, setBanner] = useState(initialBanner);
  const [busySlot, setBusySlot] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  async function upload(slot: Slot, file: File | undefined) {
    if (!file || busySlot) return;
    setError(null);

    if (!ALLOWED_TYPES.has(file.type.toLowerCase()) || file.size <= 0 || file.size > MAX_BYTES) {
      setError('Branding images must be JPEG, PNG, or WebP and no larger than 5MB.');
      return;
    }

    setBusySlot(slot);
    try {
      const form = new FormData();
      form.append('slot', slot);
      form.append('file', file);

      const response = await fetch('/api/seller/branding', {
        method: 'POST',
        body: form,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.url !== 'string') {
        throw new Error(result.error || 'Unable to upload branding image');
      }

      if (slot === 'logo') setLogo(result.url);
      else setBanner(result.url);
      await refreshProfile();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to upload branding image');
    } finally {
      setBusySlot(null);
      if (logoInput.current) logoInput.current.value = '';
      if (bannerInput.current) bannerInput.current.value = '';
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="glass-card overflow-hidden">
        <div className="aspect-[3/1] bg-charcoal/30 flex items-center justify-center overflow-hidden">
          {banner ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner} alt="Store banner" className="h-full w-full object-cover" />
          ) : (
            <p className="text-sm opacity-60">No store banner uploaded</p>
          )}
        </div>
        <div className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-bold text-accent-gold">Store banner</h2>
            <p className="mt-1 text-sm opacity-65">JPEG, PNG, or WebP. Maximum 5MB.</p>
          </div>
          <button
            type="button"
            disabled={busySlot !== null}
            onClick={() => bannerInput.current?.click()}
            className="luxury-button-outline px-4 py-2 disabled:opacity-50"
          >
            {busySlot === 'banner' ? 'Uploading…' : banner ? 'Replace banner' : 'Upload banner'}
          </button>
          <input
            ref={bannerInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => void upload('banner', event.target.files?.[0])}
          />
        </div>
      </section>

      <section className="glass-card p-5 md:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-accent-gold/20 bg-charcoal/30 flex items-center justify-center">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Store logo" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs opacity-60">No logo</span>
              )}
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-accent-gold">Store logo</h2>
              <p className="mt-1 text-sm opacity-65">Use a square image when possible. Maximum 5MB.</p>
            </div>
          </div>

          <button
            type="button"
            disabled={busySlot !== null}
            onClick={() => logoInput.current?.click()}
            className="luxury-button-outline px-4 py-2 disabled:opacity-50"
          >
            {busySlot === 'logo' ? 'Uploading…' : logo ? 'Replace logo' : 'Upload logo'}
          </button>
          <input
            ref={logoInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => void upload('logo', event.target.files?.[0])}
          />
        </div>
      </section>

      <p className="text-sm opacity-60">
        Files are validated again on the server from their actual bytes before they are accepted into EntizNetStore Storage.
      </p>
    </div>
  );
}
