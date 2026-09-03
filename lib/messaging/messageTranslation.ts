import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  computeOriginalIntegrityDigest,
  decryptMessageTranslation,
  encryptMessageTranslation,
} from "./messageTranslationCryptoCore";
import {
  executeMessageTranslation,
  normalizeTranslationLanguage,
  validateMessageTranslationConfiguration,
} from "./messageTranslationProviderCore";

type TranslationCacheRow = {
  id: string;
  message_id: string;
  target_language: string;
  provider: string;
  provider_version: string;
  original_integrity_digest: string;
  source_language: string | null;
  status: "pending" | "ready" | "failed";
  ciphertext: string | null;
  encryption_iv: string | null;
  encryption_version: string | null;
  claim_token: string | null;
  claimed_at: string | null;
  lease_expires_at: string;
  attempt_count: number;
  translated_at: string | null;
  last_error_code: string | null;
};

export type AuthorizedTranslationMessage = {
  messageId: string;
  conversationId: string;
  plaintext: string;
  originalEncryptionVersion: string;
};

export type AuthorizedTranslationResult =
  | {
      ok: true;
      translatedText: string;
      sourceLanguage: string;
      targetLanguage: string;
      provider: string;
      providerVersion: string;
      translatedAt: string;
      cached: boolean;
    }
  | {
      ok: false;
      code:
        | "message_translation_unavailable"
        | "message_translation_pending"
        | "message_translation_cache_integrity_failed"
        | "message_translation_persistence_failed";
    };

const CLAIM_LEASE_MS = 30_000;
const FAILURE_RETRY_MS = 10_000;

function launchEnabled() {
  return process.env.MESSAGE_TRANSLATION_LAUNCH_ENABLED === "true";
}

export function describeMessageTranslationReadiness() {
  const configuration = validateMessageTranslationConfiguration();
  return {
    status: launchEnabled() && configuration.ok ? ("configured" as const) : ("blocked" as const),
    configured: configuration.ok,
    launchEnabled: launchEnabled(),
  };
}

function cacheContext(
  message: AuthorizedTranslationMessage,
  targetLanguage: string,
  provider: string,
  providerVersion: string,
  originalIntegrityDigest: string,
) {
  return {
    conversationId: message.conversationId,
    messageId: message.messageId,
    targetLanguage,
    provider,
    providerVersion,
    originalIntegrityDigest,
  };
}

function decryptReadyRow(
  row: TranslationCacheRow,
  message: AuthorizedTranslationMessage,
  dataKey: Buffer,
) {
  if (
    row.status !== "ready" ||
    !row.ciphertext ||
    !row.encryption_iv ||
    !row.encryption_version ||
    !row.source_language ||
    !row.translated_at
  ) {
    return null;
  }

  const translatedText = decryptMessageTranslation(
    row.ciphertext,
    row.encryption_iv,
    dataKey,
    cacheContext(
      message,
      row.target_language,
      row.provider,
      row.provider_version,
      row.original_integrity_digest,
    ),
    row.encryption_version,
  );

  return {
    ok: true as const,
    translatedText,
    sourceLanguage: row.source_language,
    targetLanguage: row.target_language,
    provider: row.provider,
    providerVersion: row.provider_version,
    translatedAt: row.translated_at,
    cached: true,
  };
}

async function readCache(
  messageId: string,
  targetLanguage: string,
  provider: string,
  providerVersion: string,
  originalIntegrityDigest: string,
) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("message_translations")
    .select(
      "id,message_id,target_language,provider,provider_version,original_integrity_digest,source_language,status,ciphertext,encryption_iv,encryption_version,claim_token,claimed_at,lease_expires_at,attempt_count,translated_at,last_error_code",
    )
    .eq("message_id", messageId)
    .eq("target_language", targetLanguage)
    .eq("provider", provider)
    .eq("provider_version", providerVersion)
    .eq("original_integrity_digest", originalIntegrityDigest)
    .maybeSingle();

  if (error) throw new Error("Unable to read message translation cache");
  return (data as TranslationCacheRow | null) ?? null;
}

async function claimTranslation(
  messageId: string,
  targetLanguage: string,
  provider: string,
  providerVersion: string,
  originalIntegrityDigest: string,
) {
  const admin = getSupabaseAdmin();
  const claimToken = randomUUID();
  const claimedAt = new Date();
  const leaseExpiresAt = new Date(claimedAt.getTime() + CLAIM_LEASE_MS);
  const insertPayload = {
    message_id: messageId,
    target_language: targetLanguage,
    provider,
    provider_version: providerVersion,
    original_integrity_digest: originalIntegrityDigest,
    status: "pending",
    claim_token: claimToken,
    claimed_at: claimedAt.toISOString(),
    lease_expires_at: leaseExpiresAt.toISOString(),
    attempt_count: 1,
    updated_at: claimedAt.toISOString(),
  };

  const inserted = await admin
    .from("message_translations")
    .insert(insertPayload)
    .select(
      "id,message_id,target_language,provider,provider_version,original_integrity_digest,source_language,status,ciphertext,encryption_iv,encryption_version,claim_token,claimed_at,lease_expires_at,attempt_count,translated_at,last_error_code",
    )
    .single();

  if (!inserted.error) {
    return { owned: true as const, row: inserted.data as TranslationCacheRow, claimToken };
  }
  if (inserted.error.code !== "23505") {
    throw new Error("Unable to initialize message translation claim");
  }

  const existing = await readCache(
    messageId,
    targetLanguage,
    provider,
    providerVersion,
    originalIntegrityDigest,
  );
  if (!existing) throw new Error("Message translation claim race could not be recovered");
  if (existing.status === "ready") {
    return { owned: false as const, row: existing, claimToken: null };
  }

  const now = new Date();
  if (new Date(existing.lease_expires_at).getTime() > now.getTime()) {
    return { owned: false as const, row: existing, claimToken: null };
  }

  const takeoverToken = randomUUID();
  const takeoverExpiresAt = new Date(now.getTime() + CLAIM_LEASE_MS);
  const takeover = await admin
    .from("message_translations")
    .update({
      status: "pending",
      claim_token: takeoverToken,
      claimed_at: now.toISOString(),
      lease_expires_at: takeoverExpiresAt.toISOString(),
      attempt_count: existing.attempt_count + 1,
      last_error_code: null,
      updated_at: now.toISOString(),
    })
    .eq("id", existing.id)
    .in("status", ["pending", "failed"])
    .lte("lease_expires_at", now.toISOString())
    .select(
      "id,message_id,target_language,provider,provider_version,original_integrity_digest,source_language,status,ciphertext,encryption_iv,encryption_version,claim_token,claimed_at,lease_expires_at,attempt_count,translated_at,last_error_code",
    )
    .maybeSingle();

  if (takeover.error) throw new Error("Unable to recover stale message translation claim");
  if (!takeover.data) {
    const raced = await readCache(
      messageId,
      targetLanguage,
      provider,
      providerVersion,
      originalIntegrityDigest,
    );
    if (!raced) throw new Error("Message translation takeover race could not be recovered");
    return { owned: false as const, row: raced, claimToken: null };
  }

  return { owned: true as const, row: takeover.data as TranslationCacheRow, claimToken: takeoverToken };
}

export async function translateAuthorizedMessage(
  message: AuthorizedTranslationMessage,
  dataKey: Buffer,
  requestedTargetLanguage: string,
): Promise<AuthorizedTranslationResult> {
  const targetLanguage = normalizeTranslationLanguage(requestedTargetLanguage);
  const configuration = validateMessageTranslationConfiguration();
  if (!targetLanguage || !launchEnabled() || !configuration.ok) {
    return { ok: false, code: "message_translation_unavailable" };
  }

  const originalIntegrityDigest = computeOriginalIntegrityDigest(message.plaintext, dataKey, {
    conversationId: message.conversationId,
    messageId: message.messageId,
    originalEncryptionVersion: message.originalEncryptionVersion,
  });

  let claim;
  try {
    claim = await claimTranslation(
      message.messageId,
      targetLanguage,
      configuration.provider,
      configuration.providerVersion,
      originalIntegrityDigest,
    );
  } catch {
    return { ok: false, code: "message_translation_persistence_failed" };
  }

  if (!claim.owned) {
    if (claim.row.status === "ready") {
      try {
        return decryptReadyRow(claim.row, message, dataKey) ?? {
          ok: false,
          code: "message_translation_cache_integrity_failed",
        };
      } catch {
        return { ok: false, code: "message_translation_cache_integrity_failed" };
      }
    }
    return { ok: false, code: "message_translation_pending" };
  }

  const translated = await executeMessageTranslation(
    { text: message.plaintext, targetLanguage },
    configuration,
  );
  const admin = getSupabaseAdmin();

  if (!translated.ok) {
    const retryAt = new Date(Date.now() + FAILURE_RETRY_MS).toISOString();
    await admin
      .from("message_translations")
      .update({
        status: "failed",
        claim_token: null,
        last_error_code: translated.code.slice(0, 120),
        lease_expires_at: retryAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claim.row.id)
      .eq("status", "pending")
      .eq("claim_token", claim.claimToken);
    return { ok: false, code: "message_translation_unavailable" };
  }

  const encrypted = encryptMessageTranslation(
    translated.translatedText,
    dataKey,
    cacheContext(
      message,
      targetLanguage,
      configuration.provider,
      configuration.providerVersion,
      originalIntegrityDigest,
    ),
  );
  const translatedAt = new Date().toISOString();
  const completed = await admin
    .from("message_translations")
    .update({
      source_language: translated.sourceLanguage,
      status: "ready",
      ciphertext: encrypted.ciphertext,
      encryption_iv: encrypted.iv,
      encryption_version: encrypted.encryptionVersion,
      claim_token: null,
      translated_at: translatedAt,
      last_error_code: null,
      updated_at: translatedAt,
    })
    .eq("id", claim.row.id)
    .eq("status", "pending")
    .eq("claim_token", claim.claimToken)
    .select("id")
    .maybeSingle();

  if (completed.error || !completed.data) {
    return { ok: false, code: "message_translation_persistence_failed" };
  }

  return {
    ok: true,
    translatedText: translated.translatedText,
    sourceLanguage: translated.sourceLanguage,
    targetLanguage,
    provider: translated.provider,
    providerVersion: translated.providerVersion,
    translatedAt,
    cached: false,
  };
}
