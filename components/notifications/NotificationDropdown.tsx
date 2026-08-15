'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useBrand } from '@/components/BrandProvider'
import { useNotifications } from './NotificationProvider'

export default function NotificationDropdown() {
  const { brand, theme } = useBrand()
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message': return '💬'
      case 'order': return '📦'
      case 'promo': return '🎯'
      case 'payment': return '💳'
      case 'shipping': return '🚚'
      case 'system': return '⚙️'
      default: return '🔔'
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'message': return '#3B82F6'
      case 'order': return '#10B981'
      case 'promo': return '#F59E0B'
      case 'payment': return '#8B5CF6'
      case 'shipping': return '#06B6D4'
      case 'system': return '#6B7280'
      default: return theme.colors.accent
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h ago`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d ago`
    
    return date.toLocaleDateString()
  }

  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) {
      await markAsRead(notification.id)
    }
    
    if (notification.action_url) {
      setIsOpen(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg transition-all duration-200 hover:bg-opacity-20"
        style={{
          color: theme.colors.text.primary,
          backgroundColor: isOpen ? `${theme.colors.accent}20` : 'transparent'
        }}
      >
        <svg 
          className="w-6 h-6" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
          />
        </svg>
        
        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span 
            className="absolute -top-1 -right-1 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
            style={{
              backgroundColor: '#EF4444',
              color: 'white'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-96 max-h-96 overflow-y-auto rounded-lg shadow-xl border z-50"
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.glass.border
          }}
        >
          {/* Header */}
          <div className="p-4 border-b" style={{ borderColor: theme.colors.glass.border }}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold" style={{ color: theme.colors.text.primary }}>
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm hover:underline"
                  style={{ color: theme.colors.accent }}
                >
                  Mark all read
                </button>
              )}
            </div>
            {unreadCount > 0 && (
              <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
                {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center">
                <div className="animate-spin w-6 h-6 border-2 border-opacity-20 border-current rounded-full border-t-current mx-auto"></div>
                <p className="text-sm mt-2" style={{ color: theme.colors.text.secondary }}>
                  Loading notifications...
                </p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-2">🔔</div>
                <h4 className="font-medium mb-1" style={{ color: theme.colors.text.primary }}>
                  No notifications
                </h4>
                <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                  You&apos;re all caught up!
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`border-b transition-all hover:bg-opacity-50 ${
                    !notification.read ? 'bg-opacity-20' : ''
                  }`}
                  style={{
                    borderColor: theme.colors.glass.border,
                    backgroundColor: !notification.read ? `${theme.colors.accent}10` : 'transparent'
                  }}
                >
                  {notification.action_url ? (
                    <Link
                      href={notification.action_url}
                      onClick={() => handleNotificationClick(notification)}
                      className="block p-4"
                    >
                      <NotificationContent notification={notification} />
                    </Link>
                  ) : (
                    <div
                      onClick={() => handleNotificationClick(notification)}
                      className="p-4 cursor-pointer"
                    >
                      <NotificationContent notification={notification} />
                    </div>
                  )}
                  
                  {/* Delete Button */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        deleteNotification(notification.id)
                      }}
                      className="p-1 rounded hover:bg-opacity-20"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t text-center" style={{ borderColor: theme.colors.glass.border }}>
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-sm hover:underline"
                style={{ color: theme.colors.accent }}
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NotificationContent({ notification }: { notification: any }) {
  const { theme } = useBrand()
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message': return '💬'
      case 'order': return '📦'
      case 'promo': return '🎯'
      case 'payment': return '💳'
      case 'shipping': return '🚚'
      case 'system': return '⚙️'
      default: return '🔔'
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h ago`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d ago`
    
    return date.toLocaleDateString()
  }

  return (
    <div className="group relative">
      <div className="flex items-start gap-3">
        <div className="text-lg flex-shrink-0 mt-0.5">
          {getNotificationIcon(notification.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 
              className={`text-sm font-medium ${!notification.read ? 'font-semibold' : ''}`}
              style={{ color: theme.colors.text.primary }}
            >
              {notification.title}
            </h4>
            {!notification.read && (
              <div 
                className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                style={{ backgroundColor: theme.colors.accent }}
              />
            )}
          </div>
          <p 
            className="text-sm mt-1 line-clamp-2"
            style={{ color: theme.colors.text.secondary }}
          >
            {notification.message}
          </p>
          <p 
            className="text-xs mt-1"
            style={{ color: theme.colors.text.secondary }}
          >
            {formatTimeAgo(notification.created_at)}
          </p>
        </div>
      </div>
    </div>
  )
}