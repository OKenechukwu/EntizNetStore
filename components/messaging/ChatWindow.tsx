'use client'

import { useState, useRef, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'

interface ChatWindowProps {
  conversation: any
  currentUserId: string
  userType: 'buyer' | 'seller'
  onSendMessage: (content: string, attachments?: string[]) => void
}

type ChatMessage = {
  id?: string
  sender_id?: string
  content?: string
  attachments?: string[]
  created_at: string
}

type ChatFeedItem =
  | { type: 'date'; date: string; formatted: string }
  | ({ type: 'message' } & ChatMessage)

export default function ChatWindow({ 
  conversation, 
  currentUserId, 
  userType, 
  onSendMessage 
}: ChatWindowProps) {
  const { brand, theme } = useBrand()
  const [newMessage, setNewMessage] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollToBottom()
  }, [conversation.messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = () => {
    if (!newMessage.trim()) return
    
    onSendMessage(newMessage, attachments)
    setNewMessage('')
    setAttachments([])
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getMessageGroups = () => {
    if (!conversation.messages) return []
    
    const groups: ChatFeedItem[] = []
    let currentDate = ''
    
    for (const message of conversation.messages) {
      const messageDate = new Date(message.created_at).toDateString()
      
      if (messageDate !== currentDate) {
        groups.push({
          type: 'date',
          date: messageDate,
          formatted: formatDate(message.created_at)
        })
        currentDate = messageDate
      }
      
      groups.push({
        type: 'message',
        ...message
      })
    }
    
    return groups
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="p-4 border-b flex items-center justify-between"
           style={{ 
             backgroundColor: theme.colors.surface,
             borderColor: theme.colors.glass.border 
           }}>
        <div>
          <h2 className="font-semibold" style={{ color: theme.colors.text.primary }}>
            {conversation.subject || `Order #${conversation.order_id?.slice(-8)}` || 'General Inquiry'}
          </h2>
          <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
            {conversation.type === 'order_chat' && 'Order-related conversation'}
            {conversation.type === 'support' && 'Customer support'}
            {conversation.type === 'general' && (
              brand === 'primediscreet' ? 'Elite customer inquiry' : 'General inquiry'
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            conversation.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
          }`}></div>
          <span className="text-sm" style={{ color: theme.colors.text.secondary }}>
            {conversation.status === 'active' ? 'Active' : 'Closed'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {getMessageGroups().map((item, index) => (
          <div key={index}>
            {item.type === 'date' && (
              <div className="text-center py-2">
                <span className="text-xs px-3 py-1 rounded-full"
                      style={{ 
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text.secondary 
                      }}>
                  {item.formatted}
                </span>
              </div>
            )}
            
            {item.type === 'message' && (
              <div className={`flex ${
                item.sender_id === currentUserId ? 'justify-end' : 'justify-start'
              }`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  item.sender_id === currentUserId 
                    ? 'rounded-br-none' 
                    : 'rounded-bl-none'
                }`}
                style={{
                  backgroundColor: item.sender_id === currentUserId 
                    ? theme.colors.accent 
                    : theme.colors.surface,
                  color: item.sender_id === currentUserId
                    ? (brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary)
                    : theme.colors.text.primary
                }}>
                  <p className="text-sm">{item.content}</p>
                  
                  {/* Attachments */}
                  {item.attachments && item.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {item.attachments.map((attachment: string, i: number) => (
                        <a 
                          key={i}
                          href={attachment}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs underline hover:no-underline"
                        >
                          📎 Attachment {i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-xs mt-1 opacity-70">
                    {formatTime(item.created_at)}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t" 
           style={{ 
             backgroundColor: theme.colors.surface,
             borderColor: theme.colors.glass.border 
           }}>
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <div key={index} className="flex items-center gap-2 text-xs px-2 py-1 rounded"
                   style={{ backgroundColor: theme.colors.background }}>
                <span>📎 {attachment}</span>
                <button 
                  onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                  className="text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                brand === 'primediscreet' 
                  ? 'Type your elite message...' 
                  : 'Type your message...'
              }
              className="w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
              rows={1}
            />
          </div>
          
          {/* Attachment Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg border transition-all"
            style={{
              borderColor: theme.colors.glass.border,
              color: theme.colors.text.secondary
            }}
          >
            📎
          </button>
          
          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
            style={{
              backgroundColor: newMessage.trim() ? theme.colors.accent : theme.colors.background,
              color: newMessage.trim() 
                ? (brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary)
                : theme.colors.text.secondary
            }}
          >
            Send
          </button>
        </div>
        
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || [])
            const fileNames = files.map(file => file.name)
            setAttachments(prev => [...prev, ...fileNames])
          }}
        />
      </div>
    </div>
  )
}