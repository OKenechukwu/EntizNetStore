'use client'

import { useBrand } from '@/components/BrandProvider'

interface ConversationListProps {
  conversations: any[]
  activeConversation: any
  onSelectConversation: (conversation: any) => void
  loading: boolean
}

export default function ConversationList({ 
  conversations, 
  activeConversation, 
  onSelectConversation, 
  loading 
}: ConversationListProps) {
  const { brand, theme } = useBrand()

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
    }
  }

  const getConversationTitle = (conversation: any) => {
    if (conversation.subject) return conversation.subject
    if (conversation.type === 'order_chat') return `Order #${conversation.order_id?.slice(-8)}`
    return 'General Inquiry'
  }

  const getConversationSubtext = (conversation: any) => {
    if (conversation.latestMessage) {
      return conversation.latestMessage.content.length > 50
        ? conversation.latestMessage.content.substring(0, 50) + '...'
        : conversation.latestMessage.content
    }
    return 'No messages yet'
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 rounded mb-2" style={{ backgroundColor: theme.colors.background }}></div>
            <div className="h-3 rounded w-3/4" style={{ backgroundColor: theme.colors.background }}></div>
          </div>
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-4xl mb-4" style={{ color: theme.colors.accent }}>📭</div>
        <h3 className="font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
          No conversations yet
        </h3>
        <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
          {brand === 'primediscreet' 
            ? 'Elite conversations will appear here'
            : 'Your conversations will appear here'
          }
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y" style={{ borderColor: theme.colors.glass.border }}>
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          onClick={() => onSelectConversation(conversation)}
          className={`w-full p-4 text-left transition-all hover:opacity-80 ${
            activeConversation?.id === conversation.id ? 'ring-2' : ''
          }`}
          style={{
            backgroundColor: activeConversation?.id === conversation.id 
              ? theme.colors.background 
              : 'transparent',
            borderColor: activeConversation?.id === conversation.id 
              ? theme.colors.accent 
              : 'transparent'
          }}
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-medium truncate pr-2" style={{ color: theme.colors.text.primary }}>
              {getConversationTitle(conversation)}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {conversation.unreadCount > 0 && (
                <span 
                  className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white"
                  style={{ backgroundColor: theme.colors.accent }}
                >
                  {conversation.unreadCount}
                </span>
              )}
              <span className="text-xs" style={{ color: theme.colors.text.secondary }}>
                {conversation.latestMessage 
                  ? formatTime(conversation.latestMessage.created_at)
                  : formatTime(conversation.created_at)
                }
              </span>
            </div>
          </div>
          
          <p className="text-sm truncate" style={{ color: theme.colors.text.secondary }}>
            {getConversationSubtext(conversation)}
          </p>
          
          {/* Conversation Type Indicator */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              {conversation.type === 'order_chat' && (
                <span className="text-xs px-2 py-1 rounded"
                      style={{ 
                        backgroundColor: theme.colors.accent + '20',
                        color: theme.colors.accent 
                      }}>
                  Order Chat
                </span>
              )}
              {conversation.type === 'support' && (
                <span className="text-xs px-2 py-1 rounded"
                      style={{ 
                        backgroundColor: theme.colors.text.secondary + '20',
                        color: theme.colors.text.secondary 
                      }}>
                  Support
                </span>
              )}
            </div>
            
            <div className="flex items-center">
              {conversation.status === 'active' && (
                <div className="w-2 h-2 rounded-full" 
                     style={{ backgroundColor: '#10B981' }}></div>
              )}
              {conversation.status === 'closed' && (
                <div className="w-2 h-2 rounded-full" 
                     style={{ backgroundColor: '#6B7280' }}></div>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}