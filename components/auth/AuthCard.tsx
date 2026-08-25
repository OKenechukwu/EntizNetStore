// components/auth/AuthCard.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { destinationAfterAuth } from '@/lib/auth/capabilitiesClient';
import { signInWithPassword, signUpEmailPassword } from '@/lib/auth/actions';
import {
  setPendingOnboarding,
  completePendingOnboarding,
} from '@/lib/auth/pendingOnboarding';

type Role = 'buyer' | 'seller' | 'bsm';
type Mode = 'signin' | 'signup';
type Variant = 'combined' | 'signin';

function safeInternalNext(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null;
  }

  try {
    const base = new URL('https://entiznetstore.local');
    const target = new URL(value, base);
    if (target.origin !== base.origin) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export default function AuthCard({ variant = 'combined' as Variant }) {
  const router = useRouter();
  const params = useSearchParams();

  const [role, setRole] = useState<Role>('buyer');
  const [mode, setMode] = useState<Mode>(variant === 'signin' ? 'signin' : 'signin');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState('');

  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrSuggestions, setAddrSuggestions] = useState<string[]>([]);
  const addrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const append = (m: string) => setLog((s) => s + m + '\n');
  const clear = () => {
    setError(null);
    setLog('');
  };

  useEffect(() => {
    const r = (params.get('role') || '').toLowerCase();
    if (r === 'buyer' || r === 'seller' || r === 'bsm') setRole(r as Role);
    const e = params.get('email');
    if (e) setEmail(e);
    if (variant === 'combined') {
      const m = (params.get('mode') || '').toLowerCase();
      if (m === 'signin' || m === 'signup') setMode(m as Mode);
    }
  }, [params, variant]);

  const fetchAddr = async (q: string) => {
    if (!q || q.length < 3) {
      setAddrSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`);
      const data = await res.json();
      const list = (data?.features || [])
        .map((f: any) => f?.properties?.label || f?.properties?.name)
        .filter(Boolean);
      setAddrSuggestions(list);
    } catch {
      setAddrSuggestions([]);
    }
  };

  const onAddrInput = (v: string) => {
    setAddress(v);
    setAddrOpen(true);
    if (addrTimer.current) clearTimeout(addrTimer.current);
    addrTimer.current = setTimeout(() => fetchAddr(v), 300);
  };

  const selectAddr = (v: string) => {
    setAddress(v);
    setAddrOpen(false);
  };

  const goAfterAuth = async () => {
    // Authenticated: complete any pending buyer/seller/business onboarding
    // (idempotent trusted endpoint; identity derived server-side).
    await completePendingOnboarding();

    // A caller may request a same-site return target such as /checkout. Treat
    // the query string only as navigation intent, never as authorization, and
    // reject protocol-relative/external paths to avoid an open redirect.
    const requestedNext = safeInternalNext(params.get('next'));
    if (requestedNext) {
      router.push(requestedNext);
      return;
    }

    // Canonical capability-based destination (server-derived; never from
    // client-mutable user_metadata).
    router.push(await destinationAfterAuth());
  };

  const handleSubmit = async () => {
    clear();

    if (!email) return setError('Please enter your email.');
    if (!password) return setError('Please enter your password.');
    if (mode === 'signup') {
      if (!phone) return setError('Please enter your phone number.');
      if (!address) return setError('Please enter your address.');
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        append('Signing in…');
        const { error } = await signInWithPassword(email, password);
        if (error) {
          setError(error.message);
          append(`Error: ${error.message}`);
        } else {
          append('Signed in ✓');
          await goAfterAuth();
        }
      } else {
        append('Creating account…');
        const { error: signErr } = await signUpEmailPassword(email, password);
        if (signErr) {
          setError(signErr.message);
          append(`Error: ${signErr.message}`);
          setBusy(false);
          return;
        }

        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes.user?.id;
        if (uid) {
          // Store contact details only. Role/capability is never client-assigned:
          // it comes from server-created profiles or trusted app_metadata.
          const { error: metaErr } = await supabase.auth.updateUser({
            data: { phone, address },
          });
          if (metaErr) append(`Warn: metadata update failed: ${metaErr.message}`);
        }

        // Preserve the registration choice for after email verification.
        setPendingOnboarding(
          role === 'seller' ? 'seller' : role === 'bsm' ? 'business' : 'buyer',
        );
        append('Account created. Please verify your email, then sign in.');
        if (variant === 'combined') setMode('signin');
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      setError(msg);
      append(`Unexpected error: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const phoneHelp =
    role === 'buyer'
      ? 'Used for delivery updates and quick support calls.'
      : 'Used for orders & inquiries updates and, when needed, quick support calls.';

  const addressHelp =
    role === 'buyer'
      ? 'Used as your shipping address and to suggest nearby Sellers.'
      : role === 'seller'
      ? 'Used to match you with nearby shoppers and shipping partners; also used as your pickup/return address and to suggest nearby BSMs.'
      : 'Used to match you with nearby Sellers and shipping partners; also used as your pickup/warehouse address.';

  const RoleTab = ({ value, label }: { value: Role; label: string }) => (
    <button
      type="button"
      onClick={() => setRole(value)}
      className={`px-3 py-1 rounded border text-sm ${
        role === value ? 'bg-accent-gold text-black' : 'border-accent-gold text-accent-gold'
      }`}
      aria-pressed={role === value}
      disabled={busy}
    >
      {label}
    </button>
  );

  const ModeTab = ({ value, label }: { value: Mode; label: string }) =>
    variant === 'combined' ? (
      <button
        type="button"
        onClick={() => setMode(value)}
        className={`px-3 py-1 rounded border text-sm ${
          mode === value ? 'bg-accent-gold text-black' : 'border-accent-gold text-accent-gold'
        }`}
        aria-pressed={mode === value}
        disabled={busy}
      >
        {label}
      </button>
    ) : null;

  return (
    <div className="w-full max-w-xl px-4">
      <h1 className="text-2xl font-semibold mb-6 text-center">Welcome to EntizNet</h1>

      <div className="flex justify-center gap-2 mb-2">
        <RoleTab value="buyer" label="Buyer" />
        <RoleTab value="seller" label="Seller" />
        <RoleTab value="bsm" label="BSM" />
      </div>
      <p className="text-center text-xs text-foreground/60 mb-4">BSM = Brands, Suppliers & Manufacturers</p>

      {variant === 'combined' && (
        <div className="flex justify-center gap-2 mb-6">
          <ModeTab value="signin" label="Sign In" />
          <ModeTab value="signup" label="Sign Up" />
        </div>
      )}

      <form
        className="rounded-xl bg-gray-200 p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) void handleSubmit();
        }}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium mb-2">Email address</label>
            <input
              id="auth-email"
              className="w-full border rounded px-3 py-2 bg-white"
              placeholder="your@email.com"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
            {mode === 'signup' && (
              <p className="text-xs mt-1 opacity-70">We’ll use your email for account verification and security notices.</p>
            )}
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium mb-2">Password</label>
            <div className="relative">
              <input
                id="auth-password"
                className="w-full border rounded px-3 py-2 bg-white pr-24"
                placeholder={mode === 'signin' ? 'Your password' : 'Create a password'}
                type={showPw ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 border rounded"
                aria-label={showPw ? 'Hide password' : 'Show password'}
                disabled={busy}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
            {mode === 'signin' && (
              <div className="mt-1 text-right">
                <Link
                  href="/auth/forgot-password"
                  className="text-xs underline opacity-70 hover:opacity-100"
                >
                  Forgot password?
                </Link>
              </div>
            )}
          </div>

          {mode === 'signup' && (
            <>
              <div>
                <label htmlFor="auth-phone" className="block text-sm font-medium mb-2">Phone number</label>
                <input
                  id="auth-phone"
                  className="w-full border rounded px-3 py-2 bg-white"
                  placeholder={role === 'buyer' ? '+49 123 4567890' : '+49 160 1234567'}
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={busy}
                />
                <p className="text-xs mt-1 opacity-70">{phoneHelp}</p>
              </div>

              <div className="relative">
                <label htmlFor="auth-address" className="block text-sm font-medium mb-2">Address</label>
                <input
                  id="auth-address"
                  className="w-full border rounded px-3 py-2 bg-white"
                  placeholder="Street, city, country…"
                  type="text"
                  autoComplete="street-address"
                  value={address}
                  onChange={(e) => onAddrInput(e.target.value)}
                  onFocus={() => addrSuggestions.length && setAddrOpen(true)}
                  disabled={busy}
                />
                <p className="text-xs mt-1 opacity-70">{addressHelp}</p>

                {addrOpen && addrSuggestions.length > 0 && (
                  <ul
                    className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded border bg-white shadow"
                    onMouseLeave={() => setAddrOpen(false)}
                  >
                    {addrSuggestions.map((s, i) => (
                      <li
                        key={`${s}-${i}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectAddr(s);
                        }}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

          <button className="luxury-button-outline w-full py-2 disabled:opacity-60" disabled={busy} type="submit">
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </div>

        <pre className="mt-6 whitespace-pre-wrap text-sm opacity-70">{log}</pre>
        <p className="mt-4 text-xs opacity-60">By continuing, you agree to our Terms and acknowledge our Privacy Policy.</p>
      </form>
    </div>
  );
}
