import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { reportOperationalError } from "@/lib/observability/operationalEventSink";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { removeStorageObjectBestEffort } from "@/lib/storage/compensation";
import { safeOriginalFileName } from "@/lib/storage/validatedUpload";
import {
  extensionForUploadMime,
  quarantineAndFinalizeServerFile,
} from "@/lib/storage/quarantine";

const BUCKET = "message-attachments";
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const messageId = form.get("messageId");
  if (!(file instanceof File) || typeof messageId !== "string" || !messageId) {
    return NextResponse.json({ error: "File and messageId are required" }, { status: 400 });
  }
  if (
    file.size <= 0 ||
    file.size > MAX_BYTES ||
    !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())
  ) {
    return NextResponse.json(
      { error: "Attachments must be PDF, JPEG, PNG, or WebP files up to 15MB" },
      { status: 400 },
    );
  }

  // User-scoped RLS is the first authorization boundary. A caller cannot even
  // resolve an unrelated message id, and new attachments are accepted only for
  // canonical conversation-backed messages sent by the current user.
  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select("id, sender_id, conversation_id")
    .eq("id", messageId)
    .maybeSingle();
  if (messageError || !message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }
  if (message.sender_id !== user.id) {
    return NextResponse.json({ error: "Only the message sender can attach files" }, { status: 403 });
  }
  if (!message.conversation_id) {
    return NextResponse.json({ error: "Attachments require a canonical marketplace conversation" }, { status: 409 });
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", message.conversation_id)
    .neq("context_type", "legacy")
    .maybeSingle();
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const filePath = `${user.id}/${message.id}/${randomUUID()}${extensionForUploadMime(file.type)}`;
  const finalized = await quarantineAndFinalizeServerFile({
    actorId: user.id,
    purpose: "message_attachment",
    destinationBucket: BUCKET,
    destinationPath: filePath,
    file,
    maxBytes: MAX_BYTES,
  });

  if (!finalized.ok) {
    const status =
      finalized.kind === "scanner_unavailable"
        ? 503
        : finalized.kind === "blocked" || finalized.kind === "invalid_file"
          ? 400
          : 500;
    if (status >= 500) {
      await reportOperationalError("storage.message_attachment.scan_or_promotion_failed", finalized.code, {
        component: "storage",
        operation: "scan-and-promote-message-attachment",
        bucket: "upload-quarantine",
        route: "/api/messages/attachments/upload",
        actorId: user.id,
        recordId: message.id,
      });
    }
    return NextResponse.json(
      {
        error:
          finalized.kind === "scanner_unavailable"
            ? "Upload safety scanner is unavailable. The attachment was not accepted."
            : finalized.kind === "blocked"
              ? "The attachment did not pass the safety scan."
              : finalized.kind === "invalid_file"
                ? "The attachment content does not match an allowed file format."
                : "Unable to store attachment safely",
      },
      { status },
    );
  }

  const admin = getSupabaseAdmin();
  const storage = admin.storage.from(BUCKET);
  const { data: attachment, error: insertError } = await admin
    .from("message_attachments")
    .insert({
      message_id: message.id,
      file_path: finalized.destinationPath,
      file_name: safeOriginalFileName(file.name),
      file_size: finalized.size,
      mime_type: finalized.mimeType,
    })
    .select("id, message_id, file_name, file_size, mime_type, created_at")
    .single();

  if (insertError) {
    await removeStorageObjectBestEffort(storage, finalized.destinationPath, {
      bucket: BUCKET,
      operation: "rollback-attachment-registration",
      ownerId: user.id,
      recordId: message.id,
    });
    await reportOperationalError("storage.message_attachment.registration_failed", insertError, {
      component: "storage",
      operation: "register-message-attachment",
      bucket: BUCKET,
      route: "/api/messages/attachments/upload",
      actorId: user.id,
      recordId: message.id,
    });
    return NextResponse.json({ error: "Unable to register attachment" }, { status: 500 });
  }

  return NextResponse.json({ attachment }, { status: 201 });
}
