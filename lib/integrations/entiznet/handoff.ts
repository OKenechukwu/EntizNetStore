import "server-only";

import { createPublicKey, verify } from "node:crypto";

const STORE_CAPABILITIES = new Set([
  "entiznetstore_buyer",
  "entiznetstore_seller",
  "entiznetstore_business",
]);

export type EntizNetHandoffClaims = {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  emailVerified: true;
  displayName: string;
  capabilities: string[];
  capabilitiesVersion: string;
  returnPath: string;
  jti: string;
  iat: number;
  nbf: number;
  exp: number;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function safeLocalPath(value: unknown): value is string {
  return typeof value === "string"
    && value.startsWith("/")
    && !value.startsWith("//")
    && !value.includes("\\")
    && !value.includes("\u0000")
    && value.length <= 500;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parsePart<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

export function verifyEntizNetHandoff(assertion: string): EntizNetHandoffClaims {
  if (!assertion || assertion.length > 16_384) throw new Error("invalid_handoff_assertion");

  const parts = assertion.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error("invalid_handoff_format");

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parsePart<Record<string, unknown>>(encodedHeader);
  const claims = parsePart<Record<string, unknown>>(encodedPayload);

  const expectedKid = process.env.ENTIZNET_HANDOFF_KEY_ID?.trim() || "v1";
  if (header.alg !== "EdDSA" || header.typ !== "JWT" || header.kid !== expectedKid) {
    throw new Error("unsupported_handoff_signing_key");
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
  if (!valid) throw new Error("invalid_handoff_signature");

  const expectedIssuer = process.env.ENTIZNET_HANDOFF_ISSUER?.trim() || "entiznet";
  const expectedAudience = process.env.ENTIZNET_HANDOFF_AUDIENCE?.trim() || "entiznetstore";
  const now = Math.floor(Date.now() / 1000);

  if (claims.iss !== expectedIssuer || claims.aud !== expectedAudience) throw new Error("invalid_handoff_issuer_or_audience");
  if (!isUuid(claims.sub) || !isUuid(claims.jti)) throw new Error("invalid_handoff_identity");
  if (claims.emailVerified !== true || typeof claims.email !== "string" || claims.email.length > 320 || !claims.email.includes("@")) {
    throw new Error("unverified_handoff_email");
  }
  if (typeof claims.displayName !== "string" || !claims.displayName.trim() || claims.displayName.length > 120) {
    throw new Error("invalid_handoff_display_name");
  }
  if (!Array.isArray(claims.capabilities) || claims.capabilities.length < 1 || claims.capabilities.length > 3) {
    throw new Error("invalid_handoff_capabilities");
  }
  if (claims.capabilities.some((capability) => typeof capability !== "string" || !STORE_CAPABILITIES.has(capability))) {
    throw new Error("unsupported_handoff_capability");
  }
  if (new Set(claims.capabilities).size !== claims.capabilities.length) throw new Error("duplicate_handoff_capability");
  if (typeof claims.capabilitiesVersion !== "string" || claims.capabilitiesVersion.length > 200) throw new Error("invalid_capabilities_version");
  if (!safeLocalPath(claims.returnPath)) throw new Error("invalid_handoff_return_path");
  if (![claims.iat, claims.nbf, claims.exp].every((value) => typeof value === "number" && Number.isInteger(value))) {
    throw new Error("invalid_handoff_time_claims");
  }
  if ((claims.exp as number) - (claims.iat as number) > 120 || (claims.exp as number) <= (claims.iat as number)) {
    throw new Error("invalid_handoff_ttl");
  }
  if ((claims.iat as number) > now + 30 || (claims.nbf as number) > now + 30 || (claims.exp as number) <= now) {
    throw new Error("handoff_expired_or_not_yet_valid");
  }
  if ((claims.iat as number) < now - 180) throw new Error("handoff_too_old");

  return {
    iss: claims.iss as string,
    aud: claims.aud as string,
    sub: claims.sub as string,
    email: (claims.email as string).trim().toLowerCase(),
    emailVerified: true,
    displayName: (claims.displayName as string).trim(),
    capabilities: [...new Set(claims.capabilities as string[])].sort(),
    capabilitiesVersion: claims.capabilitiesVersion as string,
    returnPath: claims.returnPath as string,
    jti: claims.jti as string,
    iat: claims.iat as number,
    nbf: claims.nbf as number,
    exp: claims.exp as number,
  };
}
