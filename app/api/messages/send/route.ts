import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { MessageEncryption, sanitizeInput } from '@/lib/security';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const recipientId = typeof body?.recipientId === 'string' ? body.recipientId : '';
    const content = typeof body?.content === 'string' ? body.content : '';
    const messageType = body?.messageType === 'text' ? 'text' : 'text';
    const orderId = typeof body?.orderId === 'string' && UUID_RE.test(body.orderId) ? body.orderId : null;

    if (!UUID_RE.test(recipientId) || recipientId === user.id) {
      return NextResponse.json({ error: 'A valid recipient is required' }, { status: 400 });
    }

    const sanitizedContent = sanitizeInput(content).slice(0, 10000);
    if (!sanitizedContent) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: recipientResult, error: recipientError } = await admin.auth.admin.getUserById(recipientId);
    if (recipientError || !recipientResult.user) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
    }

    const conversationKeyId = MessageEncryption.generateConversationId(user.id, recipientId);
    let { data: conversationKey, error: keyLookupError } = await admin
      .from('conversation_keys')
      .select('encrypted_key')
      .eq('id', conversationKeyId)
      .maybeSingle();

    if (keyLookupError) {
      console.error('Conversation key lookup failed:', keyLookupError);
      return NextResponse.json({ error: 'Failed to open secure conversation' }, { status: 500 });
    }

    if (!conversationKey) {
      const newKey = await MessageEncryption.generateConversationKey();
      const exportedKey = await MessageEncryption.exportKey(newKey);
      const { data: insertedKey, error: keyError } = await admin
        .from('conversation_keys')
        .insert({
          id: conversationKeyId,
          participant1_id: user.id < recipientId ? user.id : recipientId,
          participant2_id: user.id < recipientId ? recipientId : user.id,
          encrypted_key: exportedKey,
        })
        .select('encrypted_key')
        .single();

      if (keyError?.code === '23505') {
        const { data: racedKey, error: racedKeyError } = await admin
          .from('conversation_keys')
          .select('encrypted_key')
          .eq('id', conversationKeyId)
          .single();
        if (racedKeyError || !racedKey) {
          console.error('Conversation-key race recovery failed:', racedKeyError);
          return NextResponse.json({ error: 'Failed to create secure conversation' }, { status: 500 });
        }
        conversationKey = racedKey;
      } else if (keyError || !insertedKey) {
        console.error('Error creating conversation key:', keyError);
        return NextResponse.json({ error: 'Failed to create secure conversation' }, { status: 500 });
      } else {
        conversationKey = insertedKey;
      }
    }

    const cryptoKey = await MessageEncryption.importKey(conversationKey.encrypted_key);
    const { encrypted, iv } = await MessageEncryption.encryptMessage(sanitizedContent, cryptoKey);

    const { data: message, error: messageError } = await admin
      .from('messages')
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        content: encrypted,
        message_type: messageType,
        order_id: orderId,
        is_encrypted: true,
        encryption_iv: iv,
        conversation_key_id: conversationKeyId,
      })
      .select('*')
      .single();

    if (messageError || !message) {
      console.error('Error sending message:', messageError);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: {
        ...message,
        content: sanitizedContent,
        is_encrypted: true,
        attachments: [],
      },
    });
  } catch (error) {
    console.error('Error in send message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
