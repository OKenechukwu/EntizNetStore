'use client'

import { useBrand } from '@/components/BrandProvider'

interface OrderManagementProps {
  orders: any[]
}

export default function OrderManagement({ orders }: OrderManagementProps) {
  const { brand, theme } = useBrand()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'shipped': return 'bg-blue-100 text-blue-800'
      case 'processing': return 'bg-purple-100 text-purple-800'
      case 'confirmed': return 'bg-indigo-100 text-indigo-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Order Management' : 'Order Management'}
        </h2>
        <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
          {orders.length} total orders
        </div>
      </div>

      {orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="p-6 rounded-lg border transition-all hover:shadow-lg"
              style={{ 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border 
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold" style={{ color: theme.colors.text.primary }}>
                    Order #{order.order_number}
                  </h3>
                  <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                    {new Date(order.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold mb-1" style={{ color: theme.colors.accent }}>
                    ${(order.total_cents / 100).toFixed(2)}
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(order.status)}`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Order Items */}
              {order.order_items && order.order_items.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                    Items:
                  </h4>
                  <div className="space-y-2">
                    {order.order_items.map((item: any, index: number) => (
                      <div key={index} className="flex items-center justify-between text-sm p-2 rounded"
                           style={{ backgroundColor: theme.colors.background }}>
                        <span style={{ color: theme.colors.text.primary }}>
                          {item.quantity}x {item.product_title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  className="px-4 py-2 rounded border font-medium text-sm transition-all"
                  style={{
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                >
                  View Details
                </button>
                
                {order.status === 'confirmed' && (
                  <button
                    className="px-4 py-2 rounded font-medium text-sm transition-all"
                    style={{
                      backgroundColor: theme.colors.accent,
                      color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
                    }}
                  >
                    Mark as Shipped
                  </button>
                )}

                {order.status === 'pending' && (
                  <button
                    className="px-4 py-2 rounded font-medium text-sm transition-all"
                    style={{
                      backgroundColor: theme.colors.accent,
                      color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
                    }}
                  >
                    Confirm Order
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4" style={{ color: theme.colors.accent }}>🛒</div>
          <h3 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
            No Orders Yet
          </h3>
          <p style={{ color: theme.colors.text.secondary }}>
            {brand === 'primediscreet' 
              ? 'Your elite products await their first exclusive orders'
              : 'Orders will appear here once customers start purchasing your products'
            }
          </p>
        </div>
      )}
    </div>
  )
}