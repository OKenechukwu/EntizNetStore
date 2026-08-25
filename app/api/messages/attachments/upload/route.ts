import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { reportOperationalError } from '@/lib/observability/operationalEventSink';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { removeStorageObjectBestEffort } from '@/lib/storage/compensation';
import { safeOriginalFileName, validateUploadedFile } from '@/lib/storage/validatedUpload';

const BUCKET = 'message-attachments';
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('file');
  const messageId = form.get('messageId');
  if (!(file instanceof File) || typeof messageId !== 'string' || !messageId) {
    return NextResponse.json({ error: 'File and messageId are required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: message, error: messageError } = await admin
    .from('messages')
    .select('id, sender_id, recipient_id')
    .eq('id', messageId)
    .maybeSingle();
  if (messageError || !message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }
  if (message.sender_id !== user.id) {
    return NextResponse.json({ error: 'Only the message sender can attach files' }, { status: 403 });
  }

  const validated = await validateUploadedFile(file, { maxBytes: MAX_BYTES });
  if (!validated) {
    return NextResponse.json(
      { error: 'Attachments must be a real PDF, JPEG, PNG, or WebP file up to 15MB' },
      { status: 400 },
    );
  }

  // Deliberately exclude executables, archives, office macros, scripts and
  // arbitrary binary formats. Signature validation reduces spoofing; it is not
  // represented as antivirus scanning and can later sit behind a malware scanner.
  const filePath = `${user.id}/${message.id}/${randomUUID()}${validated.extension}`;
  const storage = admin.storage.from(BUCKET);
  const { error: uploadError } = await storage.upload(filePath, validated.bytes, {
    contentType: validated.mimeType,
    upsert: false,
    cacheControl: '3600',
  });
  if (uploadError) {
    await reportOperationalError('storage.message_attachment.upload_failed', uploadError, {
      component: 'storage',
      operation: 'upload-message-attachment',
      bucket: BUCKET,
      route: '/api/messages/attachments/upload',
      actorId: user.id,
      recordId: message.id,
    });
    return NextResponse.json({ error: 'Unable to upload attachment' }, { status: 500 });
  }

  const { data: attachment, error: insertError } = await admin
    .from('message_attachments')
    .insert({
      message_id: message.id,
      file_path: filePath,
      file_name: safeOriginalFileName(file.name),
      file_size: validated.size,
      mime_type: validated.mimeType,
    })
    .select('id, message_id, file_name, file_size, mime_type, created_at')
    .single();

  if (insertError) {
    await removeStorageObjectBestEffort(
      storage,
      filePath,
      {
        bucket: BUCKET,
        operation: 'rollback-attachment-registration',
        ownerId: user.id,
        recordId: message.id,
      },
    );
    await reportOperationalError('storage.message_attachment.registration_failed', insertError, {
      component: 'storage',
      operation: 'register-message-attachment',
      bucket: BUCKET,
      route: '/api/messages/attachments/upload',
      actorId: user.id,
      recordId: message.id,
    });
    return NextResponse.json({ error: 'Unable to register attachment' }, { status: 500 });
  }

  return NextResponse.json({ attachment }, { status: 201 });
}
