// lib/auth/capabilitiesClient.ts
//
// Client-side access to the canonical capability resolver. Always resolves
// through the trusted server endpoint (/api/auth/capabilities) so browser
// code never derives capability from user_metadata, localStorage, or URL
// parameters.
"use client";

import {
  destinationForCapabilities,
  type Capabilities,
} from "./capabilityRouting";

export async function fetchCapabilities(): Promise<Capabilities | null> {
  try {
    const res = await fetch("/api/auth/capabilities", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Capabilities;
  } catch {
    return null;
  }
}

/** Canonical post-login destination for the current user. */
export async function destinationAfterAuth(): Promise<string> {
  return destinationForCapabilities(await fetchCapabilities());
}
