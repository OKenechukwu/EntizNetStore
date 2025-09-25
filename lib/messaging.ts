// Real-time messaging utilities for EntizNetStore
import { supabase } from './supabase'
import { MessageEncryption } from './security'

export interface DecryptedMessage {
  id: string
  sender_id: string
  recipient_id: string
  content: string
  message_type: 'text' | 'image' | 'order_inquiry' | 'system' | 'promo' | 'admin_chat'
  order_id?: string
  read_at?: string
  created_at: string
  is_encrypted: boolean
  sender?: any
  recipient?: any
}

export class RealTimeMessaging {
  private static conversationKeys = new Map<string, CryptoKey>()

  // Subscribe to real-time messages for a conversation
  static subscribeToConversation(
    userId: string,
    otherUserId: string,
    onMessage: (message: DecryptedMessage) => void
  ) {
    const conversationKeyId = MessageEncryption.generateConversationId(userId, otherUserId)
    
    const subscription = supabase
      .channel(`conversation:${conversationKeyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `or(and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId}))`
        },
        async (payload) => {
          try {
            const newMessage = payload.new as any
            
            // Decrypt the message if it's encrypted
            if (newMessage.is_encrypted && newMessage.encryption_iv) {
              const decryptedContent = await this.decryptMessageForDisplay(
                newMessage.content,
                newMessage.encryption_iv,
                conversationKeyId
              )
              
              onMessage({
                ...newMessage,
                content: decryptedContent
              })
            } else {
              onMessage(newMessage)
            }
          } catch (error) {
            console.error('Error processing real-time message:', error)
            onMessage({
              ...payload.new as DecryptedMessage,
              content: '[Message could not be decrypted]'
            })
          }
        }
      )
      .subscribe()

    return subscription
  }

  // Subscribe to new conversations
  static subscribeToNewConversations(
    userId: string,
    onNewConversation: (message: DecryptedMessage) => void
  ) {
    const subscription = supabase
      .channel(`user_messages:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id.eq.${userId}`
        },
        async (payload) => {
          try {
            const newMessage = payload.new as any
            
            // Decrypt the message if it's encrypted
            if (newMessage.is_encrypted && newMessage.encryption_iv && newMessage.conversation_key_id) {
              const decryptedContent = await this.decryptMessageForDisplay(
                newMessage.content,
                newMessage.encryption_iv,
                newMessage.conversation_key_id
              )
              
              onNewConversation({
                ...newMessage,
                content: decryptedContent
              })
            } else {
              onNewConversation(newMessage)
            }
          } catch (error) {
            console.error('Error processing new conversation message:', error)
            onNewConversation({
              ...payload.new as DecryptedMessage,
              content: '[Message could not be decrypted]'
            })
          }
        }
      )
      .subscribe()

    return subscription
  }

  // Helper method to decrypt messages with caching
  private static async decryptMessageForDisplay(
    encryptedContent: string,
    iv: string,
    conversationKeyId: string
  ): Promise<string> {
    try {
      // Check if we have the key cached
      let cryptoKey = this.conversationKeys.get(conversationKeyId)
      
      if (!cryptoKey) {
        // Fetch the key from database
        const { data: conversationKey } = await supabase
          .from('conversation_keys')
          .select('encrypted_key')
          .eq('id', conversationKeyId)
          .single()

        if (!conversationKey) {
          throw new Error('Conversation key not found')
        }

        cryptoKey = await MessageEncryption.importKey(conversationKey.encrypted_key)
        this.conversationKeys.set(conversationKeyId, cryptoKey)
      }

      return await MessageEncryption.decryptMessage(encryptedContent, iv, cryptoKey)
    } catch (error) {
      console.error('Decryption failed:', error)
      return '[Message could not be decrypted]'
    }
  }

  // Clean up cached keys (call on logout)
  static clearKeyCache() {
    this.conversationKeys.clear()
  }
}