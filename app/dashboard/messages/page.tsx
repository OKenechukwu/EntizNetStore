"use client";

import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { RealTimeMessaging, type DecryptedMessage } from '@/lib/messaging'
import Link from 'next/link'

// Using DecryptedMessage interface from messaging lib

interface Conversation {
  other_user: {
    id: string
    email: string
    profile?: any
  }
  last_message: DecryptedMessage
  unread_count: number
}

export default function MessagesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<DecryptedMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [realtimeSubscription, setRealtimeSubscription] = useState<any>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/sign-in')
      return
    }

    if (user?.id) {
      loadConversations()
      
      // Set up real-time subscription for new conversations
      const subscription = RealTimeMessaging.subscribeToNewConversations(
        user.id,
        (newMessage) => {
          // Refresh conversations when a new message arrives
          loadConversations()
        }
      )
      setRealtimeSubscription(subscription)
    }

    // Cleanup subscription on unmount
    return () => {
      if (realtimeSubscription) {
        realtimeSubscription.unsubscribe()
      }
      RealTimeMessaging.clearKeyCache()
    }
  }, [user, loading, router])

  const loadConversations = async () => {
    try {
      setIsLoading(true)
      
      // Get all messages where user is sender or recipient
      const { data: messagesData } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id(id, email),
          recipient:recipient_id(id, email)
        `)
        .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .order('created_at', { ascending: false })

      if (messagesData) {
        // Group messages by conversation partner
        const conversationMap = new Map<string, Conversation>()
        
        messagesData.forEach((message: any) => {
          const otherUserId = message.sender_id === user!.id ? message.recipient_id : message.sender_id
          const otherUser = message.sender_id === user!.id ? message.recipient : message.sender
          
          if (!conversationMap.has(otherUserId)) {
            conversationMap.set(otherUserId, {
              other_user: otherUser,
              last_message: message,
              unread_count: 0
            })
          }
          
          // Count unread messages
          if (message.recipient_id === user!.id && !message.read_at) {
            const conversation = conversationMap.get(otherUserId)!
            conversation.unread_count++
          }
        })
        
        setConversations(Array.from(conversationMap.values()))
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadMessages = async (otherUserId: string) => {
    try {
      // Use encrypted messaging API
      const response = await fetch(`/api/messages/conversation/${otherUserId}`)
      
      if (!response.ok) {
        throw new Error('Failed to load messages')
      }
      
      const { messages: decryptedMessages } = await response.json()
      setMessages(decryptedMessages || [])
      
      // Refresh conversations to update unread count
      loadConversations()
      
      // Set up real-time subscription for this conversation
      if (realtimeSubscription) {
        realtimeSubscription.unsubscribe()
      }
      
      const conversationSubscription = RealTimeMessaging.subscribeToConversation(
        user!.id,
        otherUserId,
        (newMessage) => {
          setMessages(prev => [...prev, newMessage])
          loadConversations() // Update conversation list
        }
      )
      setRealtimeSubscription(conversationSubscription)
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || isSending) return
    
    setIsSending(true)
    try {
      // Use encrypted messaging API
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId: selectedConversation,
          content: newMessage,
          messageType: 'text'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const { message } = await response.json()
      
      // Add message to local state (real-time will also update it)
      setMessages(prev => [...prev, message])
      setNewMessage('')
      loadConversations() // Refresh conversations list
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString()
    }
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="opacity-80">Loading messages...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="h-[calc(100vh-200px)] flex glass-card overflow-hidden">
      {/* Conversations List */}
      <div className="w-1/3 border-r border-accent-gold/20 flex flex-col">
        <div className="p-4 border-b border-accent-gold/20">
          <h2 className="font-serif text-xl font-bold text-accent-gold">Messages</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center">
              <p className="opacity-60 mb-4">No conversations yet</p>
              <Link 
                href="/store"
                className="luxury-button-outline px-4 py-2"
              >
                Browse Products
              </Link>
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.other_user.id}
                onClick={() => {
                  setSelectedConversation(conversation.other_user.id)
                  loadMessages(conversation.other_user.id)
                }}
                className={`p-4 border-b border-accent-gold/10 cursor-pointer hover:bg-accent-gold/5 transition-colors ${
                  selectedConversation === conversation.other_user.id ? 'bg-accent-gold/10' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">
                        {conversation.other_user.profile?.display_name || 
                         conversation.other_user.profile?.storefront_name || 
                         conversation.other_user.email.split('@')[0]}
                      </h3>
                      {conversation.unread_count > 0 && (
                        <span className="bg-accent-gold text-primary-black text-xs px-2 py-1 rounded-full">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="text-sm opacity-70 truncate">
                      {conversation.last_message.content}
                    </p>
                    <p className="text-xs opacity-50">
                      {formatMessageTime(conversation.last_message.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Messages Header */}
            <div className="p-4 border-b border-accent-gold/20">
              <h3 className="font-semibold">
                {conversations.find(c => c.other_user.id === selectedConversation)?.other_user.profile?.display_name ||
                 conversations.find(c => c.other_user.id === selectedConversation)?.other_user.profile?.storefront_name ||
                 conversations.find(c => c.other_user.id === selectedConversation)?.other_user.email.split('@')[0]}
              </h3>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender_id === user.id
                        ? 'bg-accent-gold text-primary-black'
                        : 'bg-charcoal/20 border border-accent-gold/20'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {formatMessageTime(message.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-accent-gold/20">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || isSending}
                  className="luxury-button px-4 py-2 disabled:opacity-50"
                >
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center opacity-60">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}