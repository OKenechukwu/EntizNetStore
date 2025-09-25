'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useBrand } from '@/components/BrandProvider'
import { getBrandClasses } from '@/lib/brand-theme'
import { useNotifications } from './NotificationProvider'

export default function NotificationsPage() {
  const { brand, theme } = useBrand()
  const { notifications, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications()
  const [filter, setFilter] = useState<string>('all')

  const brandColor = brand === 'entiznetstore' ? 'text-amber-600' : 'text-amber-400'

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

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filterOptions = [
    { value: 'all', label: 'All Notifications', count: notifications.length },
    { value: 'unread', label: 'Unread', count: notifications.filter(n => !n.read).length },
    { value: 'message', label: 'Messages', count: notifications.filter(n => n.type === 'message').length },
    { value: 'order', label: 'Orders', count: notifications.filter(n => n.type === 'order').length },
    { value: 'promo', label: 'Promotions', count: notifications.filter(n => n.type === 'promo').length }
  ]

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true
    if (filter === 'unread') return !notification.read
    return notification.type === filter
  })

  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) {
      await markAsRead(notification.id)
    }
  }

  const brandClasses = getBrandClasses(brand)

  return (
    <div className={`min-h-screen transition-all duration-500 ${brandClasses.background}`}>
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className={`text-4xl font-bold mb-2 ${brandColor}`}>
              Notifications
            </h1>
            <p className="opacity-80">
              Stay updated with your latest messages and alerts
            </p>
          </div>
          
          {notifications.filter(n => !n.read).length > 0 && (
            <button
              onClick={markAllAsRead}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${brandColor.replace('text-', 'border-')} border-2 hover:bg-opacity-10 ${brandColor.replace('text-', 'hover:bg-')}`}
            >
              Mark All Read
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-opacity-20">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`px-4 py-2 font-medium transition-all border-b-2 ${
                filter === option.value
                  ? `${brandColor} ${brandColor.replace('text-', 'border-')}`
                  : 'text-opacity-60 border-transparent hover:text-opacity-80'
              }`}
            >
              {option.label}
              {option.count > 0 && (
                <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                  filter === option.value
                    ? 'bg-opacity-20 bg-current'
                    : 'bg-opacity-10 bg-current'
                }`}>
                  {option.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-opacity-20 border-current rounded-full border-t-current mx-auto mb-4"></div>
              <p className="opacity-60">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔔</div>
              <h3 className={`text-xl font-semibold mb-2 ${brandColor}`}>
                {filter === 'all' ? 'No notifications' : `No ${filter} notifications`}
              </h3>
              <p className="opacity-60 mb-6">
                {filter === 'all' 
                  ? "You're all caught up! New notifications will appear here."
                  : `No ${filter} notifications at the moment.`
                }
              </p>
              {filter !== 'all' && (
                <button
                  onClick={() => setFilter('all')}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${brandColor.replace('text-', 'border-')} border-2 hover:bg-opacity-10 ${brandColor.replace('text-', 'hover:bg-')}`}
                >
                  View All Notifications
                </button>
              )}
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-6 rounded-lg border transition-all group hover:shadow-lg ${
                  !notification.read 
                    ? 'bg-opacity-5 border-opacity-30 bg-current border-current' 
                    : 'bg-opacity-2 border-opacity-10 bg-current border-current'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Icon */}
                    <div className="text-2xl flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className={`font-semibold ${!notification.read ? 'font-bold' : ''}`}>
                          {notification.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!notification.read && (
                            <div className={`w-2 h-2 rounded-full ${brandColor.replace('text-', 'bg-')}`} />
                          )}
                          <span className="text-sm opacity-60">
                            {formatDateTime(notification.created_at)}
                          </span>
                        </div>
                      </div>
                      
                      <p className="mb-3 opacity-80">
                        {notification.message}
                      </p>
                      
                      <div className="flex items-center gap-4">
                        {notification.action_url && (
                          <Link
                            href={notification.action_url}
                            onClick={() => handleNotificationClick(notification)}
                            className={`text-sm font-medium hover:underline ${brandColor}`}
                          >
                            View Details →
                          </Link>
                        )}
                        
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-sm opacity-60 hover:opacity-100 transition-opacity"
                          >
                            Mark as read
                          </button>
                        )}
                        
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="text-sm opacity-40 hover:opacity-100 transition-opacity ml-auto"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}