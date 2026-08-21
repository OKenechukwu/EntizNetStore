'use client'

import MessageCenter from './MessageCenter'

interface EnhancedMessageCenterProps {
  currentUserId: string
  userType: 'buyer' | 'seller'
  initialConversationId?: string
}

// Canonical messaging UI. The previous enhanced implementation duplicated the
// message data path and depended on the removed dynamic translation service.
// Keep one message center until category filtering is reintroduced on top of
// the canonical messaging contract.
export default function EnhancedMessageCenter(props: EnhancedMessageCenterProps) {
  return <MessageCenter {...props} />
}
