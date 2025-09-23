import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { MessageEncryption, sanitizeInput } from '@/lib/security'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { recipientId, content, messageType = 'text', orderId } = await request.json()
    
    if (!recipientId || !content) {
      return NextResponse.json({ 
        error: 'Recipient ID and content are required' 
      }, { status: 400 })
    }

    // Sanitize input content
    const sanitizedContent = sanitizeInput(content)
    if (sanitizedContent.length === 0) {
      return NextResponse.json({ 
        error: 'Message content cannot be empty' 
      }, { status: 400 })
    }

    // Generate conversation key ID
    const conversationKeyId = MessageEncryption.generateConversationId(user.id, recipientId)

    // Get or create conversation key
    let { data: conversationKey } = await supabase
      .from('conversation_keys')
      .select('encrypted_key')
      .eq('id', conversationKeyId)
      .single()

    if (!conversationKey) {
      // Create new conversation key
      const newKey = await MessageEncryption.generateConversationKey()
      const exportedKey = await MessageEncryption.exportKey(newKey)
      
      const { data: newConversationKey, error: keyError } = await supabase
        .from('conversation_keys')
        .insert({
          id: conversationKeyId,
          participant1_id: user.id < recipientId ? user.id : recipientId,
          participant2_id: user.id < recipientId ? recipientId : user.id,
          encrypted_key: exportedKey
        })
        .select('encrypted_key')
        .single()

      if (keyError) {
        console.error('Error creating conversation key:', keyError)
        return NextResponse.json({ error: 'Failed to create secure conversation' }, { status: 500 })
      }

      conversationKey = newConversationKey
    }

    // Import and encrypt message
    const cryptoKey = await MessageEncryption.importKey(conversationKey.encrypted_key)
    const { encrypted, iv } = await MessageEncryption.encryptMessage(sanitizedContent, cryptoKey)

    // Store encrypted message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        content: encrypted, // Store encrypted content
        message_type: messageType,
        order_id: orderId,
        is_encrypted: true,
        encryption_iv: iv,
        conversation_key_id: conversationKeyId
      })
      .select(`
        *,
        sender:sender_id(id, email),
        recipient:recipient_id(id, email)
      `)
      .single()

    if (messageError) {
      console.error('Error sending message:', messageError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Return the message with decrypted content for the sender
    const response = {
      ...message,
      content: sanitizedContent, // Return plaintext to sender
      is_encrypted: true
    }

    return NextResponse.json({ 
      success: true,
      message: response
    })
  } catch (error) {
    console.error('Error in send message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}