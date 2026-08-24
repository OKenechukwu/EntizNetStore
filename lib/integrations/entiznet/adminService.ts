import "server-only";

import { createHash, createPublicKey, verify } from "node:crypto";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED_SCOPES = new Set(["store.health", "store.accounts.read"]);

export type EntizNetAdminServiceClaims = {
  iss: string;
  aud: string;
  sub: string;
  purpose: "admin-api";
  scopes: string[];
  jti: string;
  iat: number;
  nbf: number;
  exp: number;
};

export class EntizNetAdminServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number = 401,
    public readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = "EntizNetAdminServiceError";
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new EntizNetAdminServiceError(`${name} is not configured`, 503);
  return value;
}

function parsePart<T>(value: string): T {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    throw new EntizNetAdminServiceError("invalid_admin_assertion_payload");
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function verifyEntizNetAdminAssertion(assertion: string): EntizNetAdminServiceClaims {
  if (!assertion || assertion.length > 8_192) throw new EntizNetAdminServiceError("invalid_admin_assertion");
  const parts = assertion.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new EntizNetAdminServiceError("invalid_admin_assertion_format");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parsePart<Record<string, unknown>>(encodedHeader);
  const claims = parsePart<Record<string, unknown>>(encodedPayload);

  const expectedKid = process.env.ENTIZNET_HANDOFF_KEY_ID?.trim() || "v1";
  if (header.alg !== "EdDSA" || header.typ !== "JWT" || header.kid !== expectedKid) {
    throw new EntizNetAdminServiceError("unsupported_admin_signing_key");
  }

  const publicKey = createPublicKey({
    key: Buffer.from(requiredEnv("ENTIZNET_HANDOFF_PUBLIC_KEY"), "base64"),
    format: "der",
    type: "spki",
  });
  const valid = verify(
    null,
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    publicKey,
    Buffer.from(encodedSignature, "base64url"),
  );
  if (!valid) throw new EntizNetAdminServiceError("invalid_admin_signature");

  const expectedIssuer = process.env.ENTIZNET_HANDOFF_ISSUER?.trim() || "entiznet";
  const expectedAudience = process.env.ENTIZNET_ADMIN_API_AUDIENCE?.trim() || "entiznetstore-admin-api";
  const now = Math.floor(Date.now() / 1000);

  if (claims.iss !== expectedIssuer || claims.aud !== expectedAudience) {
    throw new EntizNetAdminServiceError("invalid_admin_issuer_or_audience");
  }
  if (claims.purpose !== "admin-api") throw new EntizNetAdminServiceError("invalid_admin_assertion_purpose");
  if (!isUuid(claims.sub) || !isUuid(claims.jti)) throw new EntizNetAdminServiceError("invalid_admin_identity");
  if (!Array.isArray(claims.scopes) || claims.scopes.length < 1 || claims.scopes.length > 10) {
    throw new EntizNetAdminServiceError("invalid_admin_scopes");
  }
  if (claims.scopes.some((scope) => typeof scope !== "string" || !ALLOWED_SCOPES.has(scope))) {
    throw new EntizNetAdminServiceError("unsupported_admin_scope");
  }
  if (new Set(claims.scopes).size !== claims.scopes.length) {
    throw new EntizNetAdminServiceError("duplicate_admin_scope");
  }
  if (![claims.iat, claims.nbf, claims.exp].every((value) => typeof value === "number" && Number.isInteger(value))) {
    throw new EntizNetAdminServiceError("invalid_admin_time_claims");
  }
  if ((claims.exp as number) - (claims.iat as number) > 120 || (claims.exp as number) <= (claims.iat as number)) {
    throw new EntizNetAdminServiceError("invalid_admin_ttl");
  }
  if ((claims.iat as number) > now + 30 || (claims.nbf as number) > now + 30 || (claims.exp as number) <= now) {
    throw new EntizNetAdminServiceError("admin_assertion_expired_or_not_yet_valid");
  }
  if ((claims.iat as number) < now - 180) throw new EntizNetAdminServiceError("admin_assertion_too_old");

  return {
    iss: claims.iss as string,
    aud: claims.aud as string,
    sub: claims.sub as string,
    purpose: "admin-api",
    scopes: [...new Set(claims.scopes as string[])].sort(),
    jti: claims.jti as string,
    iat: claims.iat as number,
    nbf: claims.nbf as number,
    exp: claims.exp as number,
  };
}

function bearerAssertion(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw new EntizNetAdminServiceError("missing_admin_assertion");
  return match[1].trim();
}

export async function authenticateEntizNetAdminRequest(
  request: NextRequest,
  requiredScope: string,
) {
  const claims = verifyEntizNetAdminAssertion(bearerAssertion(request));
  if (!claims.scopes.includes(requiredScope)) {
    throw new EntizNetAdminServiceError("missing_required_admin_scope", 403);
  }

  const admin = getSupabaseAdmin();
  const jtiHash = createHash("sha256").update(claims.jti).digest("hex");
  const { data: requestId, error } = await admin.rpc("register_entiznet_admin_api_request", {
    p_jti_hash: jtiHash,
    p_entiznet_admin_id: claims.sub,
    p_issuer: claims.iss,
    p_audience: claims.aud,
    p_scopes: claims.scopes,
    p_route: request.nextUrl.pathname,
    p_method: request.method,
    p_issued_at: new Date(claims.iat * 1000).toISOString(),
    p_expires_at: new Date(claims.exp * 1000).toISOString(),
    p_metadata: {
      required_scope: requiredScope,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) || null,
    },
  });

  if (error || !requestId) {
    const replay = error?.code === "23505" || error?.message?.includes("replay");
    throw new EntizNetAdminServiceError(
      replay ? "admin_request_replay_detected" : "admin_request_registration_failed",
      replay ? 409 : 503,
    );
  }

  return { admin, claims, requestId: requestId as string };
}

export async function completeEntizNetAdminRequest(
  requestId: string,
  status: "completed" | "rejected",
  failureCode: string | null = null,
  metadata: Record<string, unknown> = {},
) {
  const admin = getSupabaseAdmin();
  const { error } = await admin.rpc("complete_entiznet_admin_api_request", {
    p_request_id: requestId,
    p_status: status,
    p_failure_code: failureCode,
    p_metadata: metadata,
  });
  if (error) console.error("[entiznet-admin-api] unable to complete request audit", error.message);
}
