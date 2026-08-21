'use client'

import { useEffect, useState } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { getSupabaseClient } from '@/lib/supabase/client'
import ConversationList from './ConversationList'
import ChatWindow from './ChatWindow'

interface MessageCenterProps {
  currentUserId: string
  userType: 'buyer' | 'seller'
  initialConversationId?: string
}

export default function MessageCenter({
  currentUserId,
  userType,
  initialConversationId,
}: MessageCenterProps) {
  const { brand, theme } = useBrand()
  const [conversations, setConversations] = useState<any[]>([])
  const [activeConversation, setActiveConversation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseClient()

  useEffect(() => {
    void loadConversations()

    const channel = supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => void loadConversations(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          if (activeConversation) void loadMessages(activeConversation.id)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [currentUserId])

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          messages(
            id, content, created_at, sender_id,
            conversation_id, is_read
          )
        `)
        .contains('participants', [currentUserId])
        .order('last_message_at', { ascending: false })

      if (error) throw error

      const processed =
        data?.map((conv) => {
          const latestMessage = conv.messages?.[conv.messages.length - 1]
          const unreadCount =
            conv.messages?.filter(
              (msg: any) => msg.sender_id !== currentUserId && !msg.is_read,
            ).length || 0
          return { ...conv, latestMessage, unreadCount }
        }) || []

      setConversations(processed)

      if (initialConversationId && !activeConversation) {
        const requested = processed.find(
          (conversation) => conversation.id === initialConversationId,
        )
        if (requested) {
          setActiveConversation(requested)
          void loadMessages(requested.id)
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error

      setActiveConversation((prev: any) => ({
        ...prev,
        messages: data || [],
      }))

      await supabase.rpc('mark_conversation_read', {
        target_conversation_id: conversationId,
      })
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const sendMessage = async (content: string, _attachments: string[] = []) => {
    if (!activeConversation || !content.trim()) return

    try {
      const recipientId = activeConversation.participants?.find(
        (id: string) => id !== currentUserId,
      )
      if (!recipientId) throw new Error('Conversation recipient is missing')

      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content.trim(),
          threadId: activeConversation.id,
          recipientId,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to send message')
      }

      await loadMessages(activeConversation.id)
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: theme.colors.background }}>
      <div
        className="w-80 border-r flex flex-col"
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border,
        }}
      >
        <div className="p-4 border-b" style={{ borderColor: theme.colors.glass.border }}>
          <h1 className="text-xl font-bold" style={{ color: theme.colors.text.primary }}>
            {brand === 'primediscreet' ? 'Elite Messages' : 'Messages'}
          </h1>
          <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
            {userType === 'seller'
              ? brand === 'primediscreet'
                ? 'Elite customer inquiries'
                : 'Customer inquiries'
              : 'Conversations with sellers'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ConversationList
            conversations={conversations}
            activeConversation={activeConversation}
            onSelectConversation={(conv) => {
              setActiveConversation(conv)
              void loadMessages(conv.id)
            }}
            loading={loading}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <ChatWindow
            conversation={activeConversation}
            currentUserId={currentUserId}
            userType={userType}
            onSendMessage={sendMessage}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4" style={{ color: theme.colors.accent }}>💬</div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
                {brand === 'primediscreet' ? 'Elite Communication Center' : 'Select a conversation'}
              </h3>
              <p style={{ color: theme.colors.text.secondary }}>
                {userType === 'seller'
                  ? brand === 'primediscreet'
                    ? 'Manage elite customer communications and exclusive inquiries'
                    : 'Choose a conversation to view customer messages'
                  : 'Select a conversation to start chatting with sellers'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
