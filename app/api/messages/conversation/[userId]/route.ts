import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { MessageEncryption } from '@/lib/security'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Check authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId: otherUserId } = await params
    if (!otherUserId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get conversation key
    const conversationKeyId = MessageEncryption.generateConversationId(user.id, otherUserId)
    const { data: conversationKey } = await supabase
      .from('conversation_keys')
      .select('encrypted_key')
      .eq('id', conversationKeyId)
      .single()

    if (!conversationKey) {
      // No conversation exists yet
      return NextResponse.json({ 
        success: true,
        messages: [] 
      })
    }

    // Get encrypted messages
    const { data: encryptedMessages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        *,
        sender:sender_id(id, email),
        recipient:recipient_id(id, email)
      `)
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true })

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    if (!encryptedMessages || encryptedMessages.length === 0) {
      return NextResponse.json({ 
        success: true,
        messages: [] 
      })
    }

    // Decrypt messages for display
    const cryptoKey = await MessageEncryption.importKey(conversationKey.encrypted_key)
    const decryptedMessages = await Promise.all(
      encryptedMessages.map(async (message) => {
        if (message.is_encrypted && message.encryption_iv) {
          try {
            const decryptedContent = await MessageEncryption.decryptMessage(
              message.content,
              message.encryption_iv,
              cryptoKey
            )
            return {
              ...message,
              content: decryptedContent
            }
          } catch (error) {
            console.error('Error decrypting message:', error)
            return {
              ...message,
              content: '[Message could not be decrypted]'
            }
          }
        }
        return message
      })
    )

    // Mark unread messages as read
    const unreadMessageIds = encryptedMessages
      .filter(msg => msg.recipient_id === user.id && !msg.read_at)
      .map(msg => msg.id)

    if (unreadMessageIds.length > 0) {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadMessageIds)
    }

    return NextResponse.json({ 
      success: true,
      messages: decryptedMessages
    })
  } catch (error) {
    console.error('Error in get conversation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
