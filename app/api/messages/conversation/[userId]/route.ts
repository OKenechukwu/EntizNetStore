import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { MessageEncryption } from '@/lib/security';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AttachmentRow = {
  id: string;
  message_id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string | null;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId: otherUserId } = await params;
    if (!UUID_RE.test(otherUserId) || otherUserId === user.id) {
      return NextResponse.json({ error: 'Valid conversation user is required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const conversationKeyId = MessageEncryption.generateConversationId(user.id, otherUserId);
    const { data: conversationKey, error: keyError } = await admin
      .from('conversation_keys')
      .select('encrypted_key, participant1_id, participant2_id')
      .eq('id', conversationKeyId)
      .maybeSingle();

    if (keyError) {
      console.error('Conversation key lookup failed:', keyError);
      return NextResponse.json({ error: 'Failed to load conversation' }, { status: 500 });
    }
    if (!conversationKey) {
      return NextResponse.json({ success: true, messages: [] });
    }

    const participants = new Set([conversationKey.participant1_id, conversationKey.participant2_id]);
    if (!participants.has(user.id) || !participants.has(otherUserId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: encryptedMessages, error: messagesError } = await admin
      .from('messages')
      .select('*')
      .eq('conversation_key_id', conversationKeyId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    const messages = encryptedMessages ?? [];
    if (messages.some((message) => {
      const validPair =
        (message.sender_id === user.id && message.recipient_id === otherUserId) ||
        (message.sender_id === otherUserId && message.recipient_id === user.id);
      return !validPair;
    })) {
      console.error('Conversation contained a message outside the expected participant pair');
      return NextResponse.json({ error: 'Conversation integrity check failed' }, { status: 500 });
    }

    const messageIds = messages.map((message) => message.id);
    let attachments: AttachmentRow[] = [];
    if (messageIds.length > 0) {
      const { data: attachmentRows, error: attachmentError } = await admin
        .from('message_attachments')
        .select('id, message_id, file_name, file_size, mime_type, created_at')
        .in('message_id', messageIds)
        .order('created_at', { ascending: true });
      if (attachmentError) {
        console.error('Error fetching message attachments:', attachmentError);
        return NextResponse.json({ error: 'Failed to fetch message attachments' }, { status: 500 });
      }
      attachments = (attachmentRows ?? []) as AttachmentRow[];
    }

    const attachmentsByMessage = new Map<string, AttachmentRow[]>();
    for (const attachment of attachments) {
      const current = attachmentsByMessage.get(attachment.message_id) ?? [];
      current.push(attachment);
      attachmentsByMessage.set(attachment.message_id, current);
    }

    const cryptoKey = await MessageEncryption.importKey(conversationKey.encrypted_key);
    const decryptedMessages = await Promise.all(
      messages.map(async (message) => {
        let content = message.content;
        if (message.is_encrypted && message.encryption_iv) {
          try {
            content = await MessageEncryption.decryptMessage(
              message.content,
              message.encryption_iv,
              cryptoKey,
            );
          } catch (error) {
            console.error('Error decrypting message:', error);
            content = '[Message could not be decrypted]';
          }
        }

        return {
          ...message,
          content,
          attachments: attachmentsByMessage.get(message.id) ?? [],
        };
      }),
    );

    const unreadMessageIds = messages
      .filter((message) => message.recipient_id === user.id && !message.read_at)
      .map((message) => message.id);

    if (unreadMessageIds.length > 0) {
      const { error: readError } = await admin
        .from('messages')
        .update({ read_at: new Date().toISOString(), is_read: true })
        .in('id', unreadMessageIds)
        .eq('recipient_id', user.id);
      if (readError) console.error('Unable to mark conversation read:', readError);
    }

    return NextResponse.json({ success: true, messages: decryptedMessages });
  } catch (error) {
    console.error('Error in get conversation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
