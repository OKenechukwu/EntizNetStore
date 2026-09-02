# Supabase key migration and browser-egress boundary

Status: production hardening contract (September 2026).

## Purpose

EntizNetStore uses Supabase as its canonical backend. Browser/SSR clients must use only public project credentials, while privileged database/storage/auth operations must use a backend-only credential that never reaches a client bundle. Browser network egress is deny-by-default and is limited to same-origin application APIs plus the configured Supabase project origin required by auth/realtime.

## Credential contract

### Browser and SSR auth clients

Preferred:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Controlled rollout fallback:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The application prefers the publishable key and uses the legacy anon key only when the publishable key has not yet been configured in that environment. Both are browser-visible credentials; authorization continues to depend on Supabase Auth, RLS, server-side authority checks and capability policies.

### Privileged server client

Preferred:

- `SUPABASE_URL` (or the public project URL as a URL-only fallback)
- `SUPABASE_SECRET_KEY`

Controlled rollout fallback:

- `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are privileged backend credentials. Neither may be named with a `NEXT_PUBLIC_*` prefix, imported by Client Components, returned by APIs, logged, embedded in static/browser chunks, or copied into mobile applications.

## Rollout sequence

Migrate environments independently so production is never forced through an all-at-once credential cutover:

1. Add `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` to the target environment's secret/config store.
2. Keep the legacy anon/service-role values temporarily so rollback remains possible.
3. Deploy the exact reviewed commit.
4. Verify sign-in/session refresh, RLS-protected reads/writes, privileged health/storage operations, checkout and authenticated browser flows.
5. Confirm browser/static artifacts contain no privileged key names or values.
6. Remove the legacy anon/service-role variables from that environment after the preferred keys are proven.
7. Rotate/revoke legacy credentials according to Supabase's supported key-management procedure and record the operational change without recording secret values.

Do not remove legacy variables from production before the preferred-key deployment is live and verified.

## Browser egress contract

Production `connect-src` is restricted to:

- `'self'` for EntizNetStore Route Handlers and same-origin resources;
- the exact configured Supabase HTTPS origin;
- the exact WebSocket origin derived from that Supabase project URL.

Scheme-wide `https:`, `http:`, `wss:` and `ws:` connect permissions are forbidden. A future browser SDK that genuinely needs another origin must add that origin explicitly, document why client-side egress is necessary, add regression coverage and pass the security review. Do not broaden CSP merely to silence a browser error.

Payment initialization remains server-authoritative. The current checkout client calls same-origin APIs and follows an approved top-level redirect when a provider returns one; this does not justify granting arbitrary payment-provider origins through `connect-src`.

## Regression gate

`scripts/verify-browser-egress-service-boundary.mjs` is part of `npm run verify:foundation`. It verifies:

- Client Components do not reference privileged Supabase environment names;
- the privileged client prefers `SUPABASE_SECRET_KEY` and retains only the explicit legacy service-role fallback;
- browser/SSR clients prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with the explicit legacy anon fallback;
- `.env.example` documents both preferred and migration variables;
- production CSP resolves to same-origin plus the exact configured Supabase HTTPS/WebSocket origins, without scheme-wide browser egress;
- when built browser chunks are present, privileged Supabase environment names do not appear in them.

Any additional external browser connection must therefore be an intentional, reviewable change rather than an ambient capability.