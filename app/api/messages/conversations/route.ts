import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { MessageEncryption } from '@/lib/security';

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_encrypted: boolean | null;
  encryption_iv: string | null;
  conversation_key_id: string | null;
  read_at: string | null;
  created_at: string;
};

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('messages')
      .select('id, sender_id, recipient_id, content, is_encrypted, encryption_iv, conversation_key_id, read_at, created_at')
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Conversation list query failed:', error);
      return NextResponse.json({ error: 'Unable to load conversations' }, { status: 500 });
    }

    const rows = (data ?? []) as MessageRow[];
    const grouped = new Map<
      string,
      { last: MessageRow; unread: number }
    >();

    for (const message of rows) {
      const otherUserId = message.sender_id === user.id ? message.recipient_id : message.sender_id;
      if (!otherUserId || otherUserId === user.id) continue;
      const current = grouped.get(otherUserId);
      if (!current) {
        grouped.set(otherUserId, {
          last: message,
          unread: message.recipient_id === user.id && !message.read_at ? 1 : 0,
        });
      } else if (message.recipient_id === user.id && !message.read_at) {
        current.unread += 1;
      }
    }

    const conversations = await Promise.all(
      Array.from(grouped.entries()).map(async ([otherUserId, entry]) => {
        let content = entry.last.content;
        if (
          entry.last.is_encrypted &&
          entry.last.encryption_iv &&
          entry.last.conversation_key_id
        ) {
          const { data: key } = await admin
            .from('conversation_keys')
            .select('encrypted_key')
            .eq('id', entry.last.conversation_key_id)
            .maybeSingle();
          if (key?.encrypted_key) {
            try {
              const cryptoKey = await MessageEncryption.importKey(key.encrypted_key);
              content = await MessageEncryption.decryptMessage(
                entry.last.content,
                entry.last.encryption_iv,
                cryptoKey,
              );
            } catch (decryptError) {
              console.error('Conversation preview decryption failed:', decryptError);
              content = '[Encrypted message]';
            }
          } else {
            content = '[Encrypted message]';
          }
        }

        const { data: otherUser } = await admin.auth.admin.getUserById(otherUserId);
        return {
          other_user: {
            id: otherUserId,
            email: otherUser.user?.email ?? '',
          },
          last_message: {
            id: entry.last.id,
            content,
            created_at: entry.last.created_at,
          },
          unread_count: entry.unread,
        };
      }),
    );

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Conversation list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
