import { isIP } from "node:net";

export type MessageTranslationEnvironment = {
  NODE_ENV?: string;
  CI?: string;
  MESSAGE_TRANSLATION_MODE?: string;
  MESSAGE_TRANSLATION_URL?: string;
  MESSAGE_TRANSLATION_ALLOWED_ORIGINS?: string;
  MESSAGE_TRANSLATION_TOKEN?: string;
  MESSAGE_TRANSLATION_PROVIDER_ID?: string;
  MESSAGE_TRANSLATION_PROVIDER_VERSION?: string;
  MESSAGE_TRANSLATION_TIMEOUT_MS?: string;
};

export type MessageTranslationConfiguration =
  | {
      ok: true;
      mode: "deterministic";
      provider: "deterministic-ci";
      providerVersion: "1";
      timeoutMs: number;
    }
  | {
      ok: true;
      mode: "remote";
      provider: string;
      providerVersion: string;
      timeoutMs: number;
      url: URL;
      token: string;
    }
  | { ok: false; code: string };

export type MessageTranslationResult =
  | {
      ok: true;
      translatedText: string;
      sourceLanguage: string;
      provider: string;
      providerVersion: string;
    }
  | { ok: false; code: string };

const DEFAULT_TIMEOUT_MS = 8_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 32 * 1024;
const MAX_TOKEN_BYTES = 4096;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TRANSLATED_CHARS = 8000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BLOCKED_PRODUCTION_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".lan",
  ".internal",
] as const;

function timeoutMs(env: MessageTranslationEnvironment) {
  const parsed = Number.parseInt(env.MESSAGE_TRANSLATION_TIMEOUT_MS || "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(parsed, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
}

function boundedIdentifier(value: string | undefined, max = 80) {
  const candidate = value?.trim();
  if (!candidate || candidate.length > max || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(candidate)) {
    return null;
  }
  return candidate;
}

function normalizeIdempotencyKey(value: string) {
  const candidate = value.trim();
  return UUID_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
}

/**
 * Normalize the bounded BCP-47 subset accepted at the translation boundary
 * without depending on optional Intl type-library declarations in the build.
 * Language is lower-case, script TitleCase, region upper-case; other validated
 * subtags are lower-case. This keeps server/client contracts deterministic.
 */
export function normalizeTranslationLanguage(value: string) {
  const candidate = value.trim().replace(/_/g, "-");
  if (!candidate || candidate.length > 35) return null;

  const parts = candidate.split("-");
  if (!/^[A-Za-z]{2,3}$/.test(parts[0] || "") || parts.length > 4) return null;
  if (parts.slice(1).some((part) => !/^[A-Za-z0-9]{2,8}$/.test(part))) return null;

  const canonical = parts.map((part, index) => {
    if (index === 0) return part.toLowerCase();
    if (/^[A-Za-z]{4}$/.test(part)) {
      return `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`;
    }
    if (/^[A-Za-z]{2}$/.test(part) || /^\d{3}$/.test(part)) return part.toUpperCase();
    return part.toLowerCase();
  }).join("-");

  return canonical.length <= 35 ? canonical : null;
}

function productionHostnameBlocked(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  const ipCandidate =
    normalized.startsWith("[") && normalized.endsWith("]")
      ? normalized.slice(1, -1)
      : normalized;
  return (
    normalized === "localhost" ||
    isIP(ipCandidate) !== 0 ||
    BLOCKED_PRODUCTION_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}

function parseAllowedOrigins(
  env: MessageTranslationEnvironment,
): { ok: true; origins: Set<string> } | { ok: false; code: string } {
  const raw = env.MESSAGE_TRANSLATION_ALLOWED_ORIGINS?.trim();
  if (!raw) {
    return env.NODE_ENV === "production"
      ? { ok: false, code: "translation_allowed_origins_missing" }
      : { ok: true, origins: new Set() };
  }

  const origins = new Set<string>();
  for (const item of raw.split(",").map((part) => part.trim()).filter(Boolean)) {
    let url: URL;
    try {
      url = new URL(item);
    } catch {
      return { ok: false, code: "translation_allowed_origins_invalid" };
    }

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    ) {
      return { ok: false, code: "translation_allowed_origins_invalid" };
    }
    origins.add(url.origin);
  }

  if (env.NODE_ENV === "production" && origins.size === 0) {
    return { ok: false, code: "translation_allowed_origins_missing" };
  }
  return { ok: true, origins };
}

export function validateMessageTranslationConfiguration(
  env: MessageTranslationEnvironment = process.env,
): MessageTranslationConfiguration {
  const mode = (env.MESSAGE_TRANSLATION_MODE || "disabled").trim().toLowerCase();

  if (mode === "disabled") return { ok: false, code: "translation_disabled" };

  if (mode === "deterministic") {
    if (env.NODE_ENV === "production" && env.CI !== "true") {
      return { ok: false, code: "translation_deterministic_forbidden_in_production" };
    }
    return {
      ok: true,
      mode: "deterministic",
      provider: "deterministic-ci",
      providerVersion: "1",
      timeoutMs: timeoutMs(env),
    };
  }

  if (mode !== "remote") return { ok: false, code: "translation_mode_unsupported" };

  const rawUrl = env.MESSAGE_TRANSLATION_URL?.trim();
  if (!rawUrl) return { ok: false, code: "translation_endpoint_missing" };

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, code: "translation_endpoint_invalid" };
  }

  if (url.username || url.password || url.search || url.hash) {
    return { ok: false, code: "translation_endpoint_unsafe" };
  }

  const localDevelopmentEndpoint =
    env.NODE_ENV !== "production" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  if (url.protocol !== "https:" && !localDevelopmentEndpoint) {
    return { ok: false, code: "translation_endpoint_must_use_https" };
  }

  if (env.NODE_ENV === "production" && productionHostnameBlocked(url.hostname)) {
    return { ok: false, code: "translation_private_host_forbidden" };
  }

  const allowed = parseAllowedOrigins(env);
  if (!allowed.ok) return allowed;
  if (allowed.origins.size > 0 && !allowed.origins.has(url.origin)) {
    return { ok: false, code: "translation_origin_not_allowed" };
  }

  const rawToken = env.MESSAGE_TRANSLATION_TOKEN;
  const token = rawToken?.trim();
  if (!token) return { ok: false, code: "translation_token_missing" };
  if (
    rawToken !== token ||
    Buffer.byteLength(rawToken, "utf8") > MAX_TOKEN_BYTES ||
    /[\u0000-\u001f\u007f]/.test(rawToken)
  ) {
    return { ok: false, code: "translation_token_invalid" };
  }

  const provider = boundedIdentifier(env.MESSAGE_TRANSLATION_PROVIDER_ID);
  if (!provider) return { ok: false, code: "translation_provider_id_invalid" };
  const providerVersion = boundedIdentifier(env.MESSAGE_TRANSLATION_PROVIDER_VERSION);
  if (!providerVersion) return { ok: false, code: "translation_provider_version_invalid" };

  return {
    ok: true,
    mode: "remote",
    provider,
    providerVersion,
    timeoutMs: timeoutMs(env),
    url,
    token,
  };
}

async function readBoundedResponseText(response: Response) {
  const contentLength = Number.parseInt(response.headers.get("content-length") || "", 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) return null;
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

export async function executeMessageTranslation(
  input: { text: string; targetLanguage: string; idempotencyKey: string },
  configuration: MessageTranslationConfiguration = validateMessageTranslationConfiguration(),
  fetchImpl: typeof fetch = fetch,
): Promise<MessageTranslationResult> {
  const targetLanguage = normalizeTranslationLanguage(input.targetLanguage);
  if (!targetLanguage) return { ok: false, code: "translation_target_language_invalid" };
  if (!input.text || input.text.length > MAX_MESSAGE_CHARS) {
    return { ok: false, code: "translation_payload_size_invalid" };
  }
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  if (!idempotencyKey) return { ok: false, code: "translation_idempotency_key_invalid" };
  if (!configuration.ok) return { ok: false, code: configuration.code };

  if (configuration.mode === "deterministic") {
    return {
      ok: true,
      translatedText: `[${targetLanguage}] ${input.text}`,
      sourceLanguage: "und",
      provider: configuration.provider,
      providerVersion: configuration.providerVersion,
    };
  }

  let response: Response;
  try {
    response = await fetchImpl(configuration.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuration.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": idempotencyKey,
        "X-EntizNetStore-Translation-Idempotency-Key": idempotencyKey,
        "X-EntizNetStore-Translation-Protocol": "2",
      },
      body: JSON.stringify({
        requestId: idempotencyKey,
        text: input.text,
        targetLanguage,
        sourceLanguage: "auto",
      }),
      signal: AbortSignal.timeout(configuration.timeoutMs),
      cache: "no-store",
      redirect: "error",
    });
  } catch (error) {
    return {
      ok: false,
      code:
        error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
          ? "translation_provider_timeout"
          : "translation_provider_request_failed",
    };
  }

  if (!response.ok) return { ok: false, code: `translation_provider_http_${response.status}` };

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (!/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/.test(contentType)) {
    return { ok: false, code: "translation_provider_content_type_invalid" };
  }

  const responseText = await readBoundedResponseText(response);
  if (responseText === null) return { ok: false, code: "translation_provider_response_too_large" };

  let payload: { requestId?: unknown; translatedText?: unknown; sourceLanguage?: unknown } | null = null;
  try {
    payload = JSON.parse(responseText) as {
      requestId?: unknown;
      translatedText?: unknown;
      sourceLanguage?: unknown;
    };
  } catch {
    return { ok: false, code: "translation_provider_response_invalid" };
  }

  if (payload.requestId !== idempotencyKey) {
    return { ok: false, code: "translation_provider_idempotency_ack_invalid" };
  }

  const translatedText = typeof payload.translatedText === "string" ? payload.translatedText.trim() : "";
  if (!translatedText || translatedText.length > MAX_TRANSLATED_CHARS) {
    return { ok: false, code: "translation_provider_translation_invalid" };
  }

  const sourceLanguage =
    typeof payload.sourceLanguage === "string"
      ? normalizeTranslationLanguage(payload.sourceLanguage) || "und"
      : "und";

  return {
    ok: true,
    translatedText,
    sourceLanguage,
    provider: configuration.provider,
    providerVersion: configuration.providerVersion,
  };
}