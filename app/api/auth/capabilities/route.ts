// GET /api/auth/capabilities
// Returns the caller's canonical capabilities (buyer/seller/admin +
// seller verification status), derived server-side from the validated
// auth user. 401 when unauthenticated.
import { NextResponse } from "next/server";
import { resolveCapabilities } from "@/lib/auth/capabilities";

export const dynamic = "force-dynamic";

export async function GET() {
  const caps = await resolveCapabilities();
  if (!caps) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(caps);
}
