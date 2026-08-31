# M4A production release evidence — 2026-08-31

M4A BSM Wholesale Marketplace is production-promoted.

## Source and deployment

- PR: #36 — `Build M4A BSM wholesale marketplace authority`
- reviewed release head: `4f74feaa67fd215e9cab4a21d7bc6b7addc2fc57`
- merge commit / current production source: `6f33095dd6f015af9126684f541314e3842dfd6c`
- Vercel production deployment: `dpl_BJCqdrvzu5fLfzS26gQUF2FJ5pCP`
- deployment state: `READY`
- production alias: `https://entiznetstore.vercel.app`

## Production health verification

`GET https://entiznetstore.vercel.app/api/health` returned HTTP 200 after deployment with:

- `status = ok`;
- `checks.database = ok`;
- `checks.storage = ok`;
- `checks.operations = ok`;
- `version = 6f33095dd6f0`, matching the merge commit prefix;
- production CSP bound to `kllwwurklumhawfsilpd.supabase.co` for HTTPS/WSS connectivity;
- private/no-store cache behavior.

Vercel runtime-error aggregation for the verification window reported no production runtime errors.

## Production database promotion

The four forward-only M4A migrations were promoted before application merge:

1. `20260829174000_m4a_bsm_wholesale_foundation.sql`;
2. `20260830063500_m4a_moq_relative_multiple_alignment.sql`;
3. `20260830165500_m4a_hosted_privilege_hardening.sql`;
4. `20260830170500_m4a_hosted_fk_index_hardening.sql`.

Production structural verification established RLS on M4A tables, reviewed authenticated RPC boundaries, hardened `SECURITY DEFINER` search paths, hosted least-privilege table ACLs, MOQ-relative ordering semantics, canonical cart/order authority and hosted FK indexes.

## Data-safety checkpoint

At this production checkpoint the canonical Store database still contains zero auth users, orders, payment sessions, payout requests, KYC documents, products and Storage objects. This is the preferred window to complete P0-01 backup/restore activation before real customer data is accepted.

## Result

**M4A status: VERIFIED / PRODUCTION.**

Remaining public-launch blockers are operational/external integration gates tracked in `LAUNCH_BLOCKERS.md`; M4A is no longer one of them.
