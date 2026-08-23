import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyEntizNetHandoff } from "@/lib/integrations/entiznet/handoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function integrationRedirect(request: NextRequest, code: string) {
  const url = new URL("/auth/sign-in", request.url);
  url.searchParams.set("integration", code);
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function failureCode(error: unknown) {
  const value = error instanceof Error ? error.message : "handoff_failed";
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 120) || "handoff_failed";
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const assertion = form?.get("assertion");
  if (typeof assertion !== "string") return integrationRedirect(request, "invalid_handoff");

  let claims;
  try {
    claims = verifyEntizNetHandoff(assertion);
  } catch (error) {
    console.error("[entiznet-handoff] assertion rejected", failureCode(error));
    return integrationRedirect(request, failureCode(error));
  }

  const admin = getSupabaseAdmin();
  const jtiHash = createHash("sha256").update(claims.jti).digest("hex");
  const { data: eventId, error: registerError } = await admin.rpc("register_entiznet_handoff", {
    p_jti_hash: jtiHash,
    p_entiznet_user_id: claims.sub,
    p_issuer: claims.iss,
    p_audience: claims.aud,
    p_return_path: claims.returnPath,
    p_capabilities_snapshot: claims.capabilities,
    p_issued_at: new Date(claims.iat * 1000).toISOString(),
    p_expires_at: new Date(claims.exp * 1000).toISOString(),
    p_metadata: {
      signing_key_id: process.env.ENTIZNET_HANDOFF_KEY_ID?.trim() || "v1",
      capabilities_version: claims.capabilitiesVersion,
    },
  });

  if (registerError || !eventId) {
    const code = registerError?.code === "23505" || registerError?.message?.includes("replay")
      ? "handoff_replay_detected"
      : "handoff_registration_failed";
    return integrationRedirect(request, code);
  }

  let storeUserId: string | null = null;

  try {
    const { data: existingLink, error: linkLookupError } = await admin
      .from("entiznet_identity_links")
      .select("store_user_id, status")
      .eq("entiznet_user_id", claims.sub)
      .maybeSingle();
    if (linkLookupError) throw new Error("identity_link_lookup_failed");

    if (existingLink?.store_user_id) {
      const linkedStoreUserId = existingLink.store_user_id as string;
      storeUserId = linkedStoreUserId;
      const { data: storeUserData, error: storeUserError } = await admin.auth.admin.getUserById(linkedStoreUserId);
      if (storeUserError || !storeUserData.user) throw new Error("linked_store_user_missing");

      if ((storeUserData.user.email || "").toLowerCase() !== claims.email) {
        const { data: resolvedId, error: resolveError } = await admin.rpc("resolve_store_auth_user_by_email", {
          p_email: claims.email,
        });
        if (resolveError) throw new Error("store_email_resolution_failed");
        if (resolvedId && resolvedId !== linkedStoreUserId) throw new Error("identity_link_email_conflict");

        const { error: updateEmailError } = await admin.auth.admin.updateUserById(linkedStoreUserId, {
          email: claims.email,
          email_confirm: true,
        });
        if (updateEmailError) throw new Error("linked_store_email_sync_failed");
      }
    } else {
      const { data: resolvedId, error: resolveError } = await admin.rpc("resolve_store_auth_user_by_email", {
        p_email: claims.email,
      });
      if (resolveError) throw new Error("store_email_resolution_failed");

      storeUserId = resolvedId || null;
      if (!storeUserId) {
        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email: claims.email,
          email_confirm: true,
          user_metadata: {
            account_source: "entiznet",
            entiznet_user_id: claims.sub,
          },
        });

        if (createError || !created.user) {
          const { data: racedId, error: racedResolveError } = await admin.rpc("resolve_store_auth_user_by_email", {
            p_email: claims.email,
          });
          if (racedResolveError || !racedId) throw new Error("store_user_creation_failed");
          storeUserId = racedId;
        } else {
          storeUserId = created.user.id;
        }
      }
    }

    if (!storeUserId) throw new Error("store_user_resolution_failed");
    const resolvedStoreUserId = storeUserId;

    const { error: syncError } = await admin.rpc("sync_entiznet_store_capabilities", {
      p_store_user_id: resolvedStoreUserId,
      p_capabilities: claims.capabilities,
      p_display_name: claims.displayName,
    });
    if (syncError) throw new Error("store_capability_sync_failed");

    const { error: linkError } = await admin.rpc("upsert_entiznet_identity_link", {
      p_store_user_id: resolvedStoreUserId,
      p_entiznet_user_id: claims.sub,
      p_capabilities_snapshot: claims.capabilities,
      p_capabilities_version: claims.capabilitiesVersion,
      p_link_source: "entiznet_handoff",
      p_metadata: {
        issuer: claims.iss,
        audience: claims.aud,
        email: claims.email,
        last_handoff_jti_hash: jtiHash,
      },
    });
    if (linkError) {
      if (linkError.code === "23505" || linkError.message?.includes("identity_link_conflict")) {
        throw new Error("identity_link_conflict");
      }
      throw new Error("identity_link_update_failed");
    }

    const { data: magicLink, error: magicLinkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: claims.email,
    });
    const tokenHash = magicLink?.properties?.hashed_token;
    if (magicLinkError || !tokenHash) throw new Error("store_session_token_generation_failed");

    const storeSupabase = await createServerSupabase();
    const { data: sessionData, error: sessionError } = await storeSupabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: tokenHash,
    });
    if (sessionError || !sessionData.session || sessionData.user?.id !== resolvedStoreUserId) {
      throw new Error("store_session_establishment_failed");
    }

    const { error: completeError } = await admin.rpc("complete_entiznet_handoff", {
      p_event_id: eventId,
      p_store_user_id: resolvedStoreUserId,
      p_status: "consumed",
      p_failure_code: null,
    });
    if (completeError) throw new Error("handoff_completion_failed");

    const response = NextResponse.redirect(new URL(claims.returnPath, request.url), 303);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    const code = failureCode(error);
    console.error("[entiznet-handoff] consumption failed", code);

    const { error: completionError } = await admin.rpc("complete_entiznet_handoff", {
      p_event_id: eventId,
      p_store_user_id: storeUserId,
      p_status: "rejected",
      p_failure_code: code,
    });
    if (completionError) console.error("[entiznet-handoff] failed to record rejection", completionError.message);

    return integrationRedirect(request, code);
  }
}
