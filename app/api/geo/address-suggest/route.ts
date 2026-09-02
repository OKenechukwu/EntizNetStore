import { NextRequest, NextResponse } from "next/server";
import { fetchAddressSuggestions, normalizeAddressQuery } from "@/lib/geo/addressSuggestions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 1024;

async function readBoundedBody(request: NextRequest): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new Error("request_too_large");
  }

  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel("request_too_large").catch(() => {});
        throw new Error("request_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    throw new Error("invalid_utf8");
  }
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.startsWith("application/json")) {
    return NextResponse.json(
      { error: "Unsupported Media Type" },
      { status: 415, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  let text: string;
  try {
    text = await readBoundedBody(request);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "request_too_large";
    return NextResponse.json(
      { error: tooLarge ? "Request Too Large" : "Invalid Request" },
      {
        status: tooLarge ? 413 : 400,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  const query = normalizeAddressQuery(
    payload && typeof payload === "object" ? (payload as { query?: unknown }).query : null,
  );
  if (!query) {
    return NextResponse.json(
      { suggestions: [], available: true },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  try {
    const suggestions = await fetchAddressSuggestions(query);
    return NextResponse.json(
      { suggestions, available: true },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch {
    // Address autocomplete is assistive, never authoritative. Fail softly so a
    // provider outage cannot prevent registration or manual address entry.
    return NextResponse.json(
      { suggestions: [], available: false },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}
