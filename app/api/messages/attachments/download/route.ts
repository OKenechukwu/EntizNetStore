import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const BUCKET = 'message-attachments';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const attachmentId = request.nextUrl.searchParams.get('id');
  if (!attachmentId) {
    return NextResponse.json({ error: 'Attachment id is required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: attachment, error: attachmentError } = await admin
    .from('message_attachments')
    .select('id, message_id, file_path, file_name, mime_type')
    .eq('id', attachmentId)
    .maybeSingle();
  if (attachmentError || !attachment) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  }

  const { data: message } = await admin
    .from('messages')
    .select('sender_id, recipient_id')
    .eq('id', attachment.message_id)
    .maybeSingle();
  if (!message || (message.sender_id !== user.id && message.recipient_id !== user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(attachment.file_path, 120);
  if (error || !data?.signedUrl) {
    console.error('Message attachment signing failed:', error);
    return NextResponse.json({ error: 'Unable to create attachment link' }, { status: 500 });
  }

  return NextResponse.json({
    url: data.signedUrl,
    expiresIn: 120,
    fileName: attachment.file_name,
    mimeType: attachment.mime_type,
  });
}
