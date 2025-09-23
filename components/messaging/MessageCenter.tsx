'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import ConversationList from './ConversationList'
import ChatWindow from './ChatWindow'

interface MessageCenterProps {
  currentUserId: string
  userType: 'buyer' | 'seller'
}

export default function MessageCenter({ currentUserId, userType }: MessageCenterProps) {
  const { brand, theme } = useBrand()
  const [conversations, setConversations] = useState<any[]>([])
  const [activeConversation, setActiveConversation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    loadConversations()
    
    // Set up real-time subscription for new messages
    const channel = supabase.channel('conversations')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'conversations' },
        () => loadConversations()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          if (activeConversation) {
            loadMessages(activeConversation.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
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
            conversation_id
          )
        `)
        .contains('participants', [currentUserId])
        .order('last_message_at', { ascending: false })

      if (error) throw error

      // Process conversations to include latest message and unread count
      const processedConversations = data?.map(conv => {
        const latestMessage = conv.messages?.[conv.messages.length - 1]
        const unreadCount = conv.messages?.filter(
          (msg: any) => msg.sender_id !== currentUserId && !msg.is_read
        ).length || 0

        return {
          ...conv,
          latestMessage,
          unreadCount
        }
      }) || []

      setConversations(processedConversations)
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

      setActiveConversation(prev => ({
        ...prev,
        messages: data || []
      }))

      // Mark messages as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUserId)

    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const sendMessage = async (content: string, attachments: string[] = []) => {
    if (!activeConversation || !content.trim()) return

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversation.id,
          sender_id: currentUserId,
          content: content.trim(),
          attachments: attachments,
          is_read: false
        })

      if (error) throw error

      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ 
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', activeConversation.id)

      // Reload messages
      loadMessages(activeConversation.id)
      
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const startConversation = async (otherUserId: string, subject: string, orderT?: string) => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          type: orderT ? 'order_chat' : 'general',
          participants: [currentUserId, otherUserId],
          subject: subject,
          order_id: orderT || null,
          status: 'active'
        })
        .select()
        .single()

      if (error) throw error

      await loadConversations()
      setActiveConversation(data)
      
    } catch (error) {
      console.error('Error starting conversation:', error)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: theme.colors.background }}>
      {/* Sidebar - Conversation List */}
      <div className="w-80 border-r flex flex-col" 
           style={{ 
             backgroundColor: theme.colors.surface,
             borderColor: theme.colors.glass.border 
           }}>
        {/* Header */}
        <div className="p-4 border-b" style={{ borderColor: theme.colors.glass.border }}>
          <h1 className="text-xl font-bold" style={{ color: theme.colors.text.primary }}>
            {brand === 'primediscreet' ? 'Elite Messages' : 'Messages'}
          </h1>
          <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
            {userType === 'seller' 
              ? (brand === 'primediscreet' ? 'Elite customer inquiries' : 'Customer inquiries')
              : 'Conversations with sellers'
            }
          </p>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          <ConversationList 
            conversations={conversations}
            activeConversation={activeConversation}
            onSelectConversation={(conv) => {
              setActiveConversation(conv)
              loadMessages(conv.id)
            }}
            loading={loading}
          />
        </div>

        {/* New Conversation Button */}
        <div className="p-4 border-t" style={{ borderColor: theme.colors.glass.border }}>
          <button
            onClick={() => {
              // This would open a modal to start new conversation
              // For now, just placeholder
            }}
            className="w-full px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              backgroundColor: theme.colors.accent,
              color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
            }}
          >
            {brand === 'primediscreet' ? 'Elite Inquiry' : 'New Message'}
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <ChatWindow 
            conversation={activeConversation}
            currentUserId={currentUserId}
            userType={userType}
            onSendMessage={sendMessage}
          />
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4" style={{ color: theme.colors.accent }}>
                💬
              </div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
                {brand === 'primediscreet' 
                  ? 'Elite Communication Center'
                  : 'Select a conversation'
                }
              </h3>
              <p style={{ color: theme.colors.text.secondary }}>
                {userType === 'seller'
                  ? (brand === 'primediscreet' 
                      ? 'Manage elite customer communications and exclusive inquiries'
                      : 'Choose a conversation to view customer messages'
                    )
                  : 'Select a conversation to start chatting with sellers'
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}