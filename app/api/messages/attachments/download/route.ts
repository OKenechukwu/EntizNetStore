import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logOperationalError } from "@/lib/observability/operationalEvent";

const BUCKET = "message-attachments";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const attachmentId = request.nextUrl.searchParams.get("id");
  if (!attachmentId || !UUID_RE.test(attachmentId)) {
    return NextResponse.json({ error: "A valid attachment id is required" }, { status: 400 });
  }

  // The authenticated client can resolve this row only if attachment RLS can
  // prove the caller participates in its parent message/conversation.
  const { data: attachment, error: attachmentError } = await supabase
    .from("message_attachments")
    .select("id, message_id, file_path, file_name, mime_type")
    .eq("id", attachmentId)
    .maybeSingle();
  if (attachmentError) {
    logOperationalError("store_chat_attachment_lookup_failed", attachmentError, {
      component: "messaging",
      operation: "attachment-download-authorization",
      route: "/api/messages/attachments/download",
      actorId: user.id,
      recordId: attachmentId,
    });
    return NextResponse.json({ error: "Unable to load attachment" }, { status: 500 });
  }
  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(attachment.file_path, 120);
  if (error || !data?.signedUrl) {
    logOperationalError("store_chat_attachment_sign_failed", error || new Error("signed url missing"), {
      component: "messaging",
      operation: "attachment-sign",
      route: "/api/messages/attachments/download",
      actorId: user.id,
      recordId: attachment.id,
    });
    return NextResponse.json({ error: "Unable to create attachment link" }, { status: 500 });
  }

  return NextResponse.json({
    url: data.signedUrl,
    expiresIn: 120,
    fileName: attachment.file_name,
    mimeType: attachment.mime_type,
  });
}
