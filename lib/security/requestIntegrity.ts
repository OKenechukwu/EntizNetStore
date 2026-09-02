const UNSAFE_API_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * These routes intentionally accept cross-site/server-to-server POSTs and
 * authenticate the request with their own cryptographic/provider boundary.
 * Keep this list exact: prefix/wildcard exemptions would weaken the browser
 * request-integrity boundary for unrelated APIs.
 */
export const REQUEST_INTEGRITY_EXEMPT_PATHS = new Set([
  "/api/integrations/entiznet/handoff",
  "/api/payments/webhook",
  "/api/payments/payout-webhook",
]);

export type RequestIntegrityFailure =
  | "cross_site"
  | "invalid_origin"
  | "origin_mismatch"
  | "same_site_without_origin";

export type RequestIntegrityInput = {
  method: string;
  pathname: string;
  requestOrigin: string;
  originHeader?: string | null;
  secFetchSite?: string | null;
};

export type RequestIntegrityDecision =
  | { allowed: true; protected: boolean; exempt: boolean }
  | { allowed: false; protected: true; exempt: false; reason: RequestIntegrityFailure };

function isProtectedMutation(method: string, pathname: string) {
  return pathname.startsWith("/api/") && UNSAFE_API_METHODS.has(method.toUpperCase());
}

function normalizeOrigin(value: string) {
  if (value === "null") return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    if (url.origin !== value) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Next.js can internally canonicalize a request URL host (for example to
 * localhost) even when the browser connected through another equivalent local
 * hostname. Browser JavaScript cannot set the Host header, so use that header
 * to reconstruct the browser-facing origin while preserving the runtime
 * protocol. Invalid or ambiguous Host values fail back to the runtime origin.
 */
export function resolveRequestOrigin(input: {
  requestOrigin: string;
  hostHeader?: string | null;
}) {
  let runtimeOrigin: URL;
  try {
    runtimeOrigin = new URL(input.requestOrigin);
  } catch {
    return input.requestOrigin;
  }

  const rawHost = input.hostHeader?.trim();
  if (!rawHost || rawHost.includes(",") || /[\s/@?#\\]/.test(rawHost)) {
    return runtimeOrigin.origin;
  }

  try {
    const candidate = new URL(`${runtimeOrigin.protocol}//${rawHost}`);
    const canonicalHost = rawHost.toLowerCase();
    if (
      candidate.username ||
      candidate.password ||
      candidate.pathname !== "/" ||
      candidate.search ||
      candidate.hash ||
      candidate.host !== canonicalHost
    ) {
      return runtimeOrigin.origin;
    }
    return candidate.origin;
  } catch {
    return runtimeOrigin.origin;
  }
}

/**
 * Enforces browser request integrity for cookie-authenticated API mutations.
 *
 * Browser requests must prove same-origin through Fetch Metadata and/or the
 * Origin header. Requests with neither header are intentionally allowed so
 * non-browser provider/service clients remain usable; those endpoints must
 * still enforce their own authentication/signature contracts.
 */
export function evaluateRequestIntegrity(input: RequestIntegrityInput): RequestIntegrityDecision {
  const method = input.method.toUpperCase();
  if (!isProtectedMutation(method, input.pathname)) {
    return { allowed: true, protected: false, exempt: false };
  }

  if (REQUEST_INTEGRITY_EXEMPT_PATHS.has(input.pathname)) {
    return { allowed: true, protected: true, exempt: true };
  }

  const fetchSite = input.secFetchSite?.trim().toLowerCase() || "";
  if (fetchSite === "cross-site") {
    return { allowed: false, protected: true, exempt: false, reason: "cross_site" };
  }

  const rawOrigin = input.originHeader?.trim() || "";
  if (rawOrigin) {
    const origin = normalizeOrigin(rawOrigin);
    if (!origin) {
      return { allowed: false, protected: true, exempt: false, reason: "invalid_origin" };
    }

    if (origin !== input.requestOrigin) {
      return { allowed: false, protected: true, exempt: false, reason: "origin_mismatch" };
    }

    return { allowed: true, protected: true, exempt: false };
  }

  // `same-site` is not equivalent to same-origin: a sibling subdomain can be
  // attacker-controlled. Require an exact Origin proof for this browser case.
  if (fetchSite === "same-site") {
    return {
      allowed: false,
      protected: true,
      exempt: false,
      reason: "same_site_without_origin",
    };
  }

  return { allowed: true, protected: true, exempt: false };
}
