'use client'

import { useState, useEffect, useRef } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { RealTimeMessaging, DecryptedMessage } from '@/lib/messaging'
import { useBrand } from '@/components/BrandProvider'

export const AdminChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [messages, setMessages] = useState<DecryptedMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const { brand, theme } = useBrand()
  const supabase = getSupabaseClient()
  
  // Admin user ID - in production this would be dynamic
  const ADMIN_USER_ID = 'admin-support-team'

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user && isOpen) {
      loadMessages()
      subscribeToMessages()
    }
  }, [user, isOpen])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        // Load unread count even when widget is closed
        loadUnreadCount()
      }
    } catch (error) {
      console.error('Error checking user:', error)
    }
  }

  const loadMessages = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          recipient_id,
          content,
          message_type,
          created_at,
          read_at,
          is_encrypted
        `)
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${ADMIN_USER_ID}),and(sender_id.eq.${ADMIN_USER_ID},recipient_id.eq.${user.id})`)
        .eq('message_type', 'admin_chat')
        .order('created_at', { ascending: true })

      if (error) throw error

      setMessages(messagesData || [])
      
      // Mark messages as read
      if (messagesData && messagesData.length > 0) {
        await markMessagesAsRead()
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUnreadCount = async () => {
    if (!user) return

    try {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('sender_id', ADMIN_USER_ID)
        .eq('message_type', 'admin_chat')
        .is('read_at', null)

      if (error) throw error
      setUnreadCount(count || 0)
    } catch (error) {
      console.error('Error loading unread count:', error)
    }
  }

  const markMessagesAsRead = async () => {
    if (!user) return

    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', user.id)
        .eq('sender_id', ADMIN_USER_ID)
        .eq('message_type', 'admin_chat')
        .is('read_at', null)
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }
  }

  const subscribeToMessages = () => {
    if (!user) return null

    return RealTimeMessaging.subscribeToConversation(
      user.id,
      ADMIN_USER_ID,
      (newMessage) => {
        setMessages(prev => [...prev, newMessage])
        if (!isOpen) {
          setUnreadCount(prev => prev + 1)
        }
      }
    )
  }

  const sendMessage = async () => {
    if (!user || !newMessage.trim()) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: ADMIN_USER_ID,
          content: newMessage.trim(),
          message_type: 'admin_chat',
          is_encrypted: false
        })

      if (error) throw error

      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  if (!user) return null

  return (
    <>
      {/* Chat Widget Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close customer support chat' : 'Open customer support chat'}
        aria-expanded={isOpen}
        aria-controls="customer-support-chat"
        className="fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-50 flex items-center justify-center"
        style={{ 
          backgroundColor: theme.colors.accent,
          color: 'white'
        }}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {unreadCount > 0 && (
              <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold" aria-hidden="true">
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
          </>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          id="customer-support-chat"
          className="fixed bottom-24 right-6 w-80 h-96 border rounded-lg shadow-xl z-50 flex flex-col"
          style={{ 
            borderColor: theme.colors.glass.border, 
            backgroundColor: theme.colors.surface 
          }}
        >
          
          {/* Header */}
          <div className="p-4 border-b rounded-t-lg" 
               style={{ 
                 borderColor: theme.colors.glass.border,
                 backgroundColor: theme.colors.accent 
               }}>
            <h3 className="font-semibold text-white">
              {brand === 'primediscreet' ? 'Elite Support' : 'Customer Support'}
            </h3>
            <p className="text-sm text-white/80">
              We&apos;re here to help you
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {loading && messages.length === 0 ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto" 
                     style={{ borderColor: theme.colors.accent }}></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2" style={{ color: theme.colors.accent }}>
                  👋
                </div>
                <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                  Hello! How can we help you today?
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      message.sender_id === user.id
                        ? 'rounded-br-none'
                        : 'rounded-bl-none'
                    }`}
                    style={{
                      backgroundColor: message.sender_id === user.id 
                        ? theme.colors.accent 
                        : theme.colors.background,
                      color: message.sender_id === user.id 
                        ? 'white' 
                        : theme.colors.text.primary
                    }}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.sender_id === user.id ? 'text-white/70' : ''
                    }`} style={{ 
                      color: message.sender_id === user.id 
                        ? 'rgba(255,255,255,0.7)' 
                        : theme.colors.text.secondary 
                    }}>
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t" style={{ borderColor: theme.colors.glass.border }}>
            <div className="flex gap-2">
              <label htmlFor="customer-support-message" className="sr-only">
                Message customer support
              </label>
              <input
                id="customer-support-message"
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type your message..."
                disabled={loading}
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{
                  borderColor: theme.colors.glass.border,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text.primary
                }}
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={loading || !newMessage.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50"
                style={{
                  backgroundColor: theme.colors.accent,
                  color: 'white'
                }}
              >
                {loading ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}