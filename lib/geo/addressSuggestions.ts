const PHOTON_ENDPOINT = "https://photon.komoot.io/api/";
const MAX_QUERY_CHARS = 160;
const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_SUGGESTIONS = 5;
const MAX_SUGGESTION_CHARS = 240;
const UPSTREAM_TIMEOUT_MS = 3_500;

export type AddressSuggestionProvider = "photon_demo" | "deterministic";

type AddressSuggestionEnvironment = Pick<
  NodeJS.ProcessEnv,
  "ADDRESS_SUGGEST_PROVIDER" | "CI" | "VERCEL_ENV"
>;

type PhotonFeature = {
  properties?: {
    label?: unknown;
    name?: unknown;
  };
};

type PhotonPayload = {
  features?: unknown;
};

export function normalizeAddressQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < 3 || normalized.length > MAX_QUERY_CHARS) return null;
  return normalized;
}

export function configuredAddressSuggestionProvider(
  env: AddressSuggestionEnvironment = process.env,
): AddressSuggestionProvider {
  const configured = env.ADDRESS_SUGGEST_PROVIDER?.trim().toLowerCase();
  if (!configured || configured === "photon_demo") return "photon_demo";
  if (configured === "deterministic") return "deterministic";
  throw new Error("address_suggest_provider_invalid");
}

function deterministicSuggestions(
  query: string,
  env: AddressSuggestionEnvironment,
): string[] {
  if (env.CI !== "true" || env.VERCEL_ENV === "production") {
    throw new Error("deterministic_address_suggest_forbidden");
  }

  return query.toLowerCase().startsWith("bag")
    ? [
        "1 Session Road, Baguio City, Philippines",
        "2 Burnham Park, Baguio City, Philippines",
      ]
    : [];
}

function sanitizeSuggestion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;
  return normalized.slice(0, MAX_SUGGESTION_CHARS);
}

function suggestionsFromPhoton(payload: PhotonPayload): string[] {
  if (!Array.isArray(payload.features)) return [];

  const output: string[] = [];
  const seen = new Set<string>();
  for (const rawFeature of payload.features.slice(0, MAX_SUGGESTIONS * 2)) {
    if (!rawFeature || typeof rawFeature !== "object") continue;
    const feature = rawFeature as PhotonFeature;
    const suggestion = sanitizeSuggestion(
      feature.properties?.label ?? feature.properties?.name,
    );
    if (!suggestion || seen.has(suggestion)) continue;
    seen.add(suggestion);
    output.push(suggestion);
    if (output.length >= MAX_SUGGESTIONS) break;
  }
  return output;
}

async function readBoundedJson(response: Response): Promise<PhotonPayload> {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("json")) throw new Error("address_provider_invalid_content_type");

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("address_provider_response_too_large");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_RESPONSE_BYTES) {
    throw new Error("address_provider_response_too_large");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("address_provider_invalid_json");
  }
  if (!parsed || typeof parsed !== "object") return {};
  return parsed as PhotonPayload;
}

export async function fetchAddressSuggestions(
  rawQuery: unknown,
  options: {
    provider?: AddressSuggestionProvider;
    fetchImpl?: typeof fetch;
    env?: AddressSuggestionEnvironment;
  } = {},
): Promise<string[]> {
  const query = normalizeAddressQuery(rawQuery);
  if (!query) return [];

  const env = options.env ?? process.env;
  const provider = options.provider ?? configuredAddressSuggestionProvider(env);
  if (provider === "deterministic") return deterministicSuggestions(query, env);

  const upstream = new URL(PHOTON_ENDPOINT);
  upstream.searchParams.set("q", query);
  upstream.searchParams.set("limit", String(MAX_SUGGESTIONS));

  const response = await (options.fetchImpl ?? fetch)(upstream, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "EntizNetStore-AddressSuggest/1.0",
    },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error("address_provider_unavailable");
  return suggestionsFromPhoton(await readBoundedJson(response));
}
