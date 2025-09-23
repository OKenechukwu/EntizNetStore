'use client'

import { useBrand } from '@/components/BrandProvider'

interface SellerAnalyticsProps {
  products: any[]
  orders: any[]
  reviews: any[]
}

export default function SellerAnalytics({ products, orders, reviews }: SellerAnalyticsProps) {
  const { brand, theme } = useBrand()

  // Calculate analytics
  const totalRevenue = orders.reduce((sum, order) => sum + (order.total_cents / 100), 0)
  const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0
  const totalReviews = reviews.length
  const averageRating = totalReviews > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
    : 0

  // Monthly data (simplified for demo)
  const currentMonth = new Date().getMonth()
  const monthlyOrders = orders.filter(order => 
    new Date(order.created_at).getMonth() === currentMonth
  )
  const monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + (order.total_cents / 100), 0)

  // Product performance
  const productPerformance = products.map(product => {
    const productOrders = orders.filter(order =>
      order.order_items?.some((item: any) => item.product_title === product.title)
    )
    const productRevenue = productOrders.reduce((sum, order) => sum + (order.total_cents / 100), 0)
    
    return {
      id: product.id,
      title: product.title,
      orders: productOrders.length,
      revenue: productRevenue,
      brand: product.marketplace_brand
    }
  }).sort((a, b) => b.revenue - a.revenue)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Performance Analytics' : 'Seller Analytics'}
        </h2>
        <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
          {brand === 'primediscreet' ? 'Discrete insights for elite sellers' : 'Track your performance'}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-lg" style={{ 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border 
        }}>
          <h3 className="font-medium mb-2" style={{ color: theme.colors.text.secondary }}>
            Total Revenue
          </h3>
          <p className="text-3xl font-bold" style={{ color: theme.colors.accent }}>
            ${totalRevenue.toFixed(2)}
          </p>
          <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
            All time
          </p>
        </div>

        <div className="p-6 rounded-lg" style={{ 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border 
        }}>
          <h3 className="font-medium mb-2" style={{ color: theme.colors.text.secondary }}>
            Average Order Value
          </h3>
          <p className="text-3xl font-bold" style={{ color: theme.colors.accent }}>
            ${averageOrderValue.toFixed(2)}
          </p>
          <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
            Per order
          </p>
        </div>

        <div className="p-6 rounded-lg" style={{ 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border 
        }}>
          <h3 className="font-medium mb-2" style={{ color: theme.colors.text.secondary }}>
            Customer Rating
          </h3>
          <p className="text-3xl font-bold" style={{ color: theme.colors.accent }}>
            {averageRating > 0 ? averageRating.toFixed(1) : 'N/A'}
            {averageRating > 0 && <span className="text-lg ml-1">⭐</span>}
          </p>
          <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
            {totalReviews} reviews
          </p>
        </div>

        <div className="p-6 rounded-lg" style={{ 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border 
        }}>
          <h3 className="font-medium mb-2" style={{ color: theme.colors.text.secondary }}>
            This Month
          </h3>
          <p className="text-3xl font-bold" style={{ color: theme.colors.accent }}>
            ${monthlyRevenue.toFixed(2)}
          </p>
          <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
            {monthlyOrders.length} orders
          </p>
        </div>
      </div>

      {/* Product Performance */}
      <div className="p-6 rounded-lg" style={{ 
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.glass.border 
      }}>
        <h3 className="text-xl font-semibold mb-6" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Product Performance' : 'Product Performance'}
        </h3>
        
        {productPerformance.length > 0 ? (
          <div className="space-y-4">
            {productPerformance.slice(0, 10).map((product, index) => (
              <div key={product.id} className="flex items-center justify-between p-4 rounded border"
                   style={{ borderColor: theme.colors.glass.border }}>
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                       style={{ 
                         backgroundColor: theme.colors.accent,
                         color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
                       }}>
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-medium" style={{ color: theme.colors.text.primary }}>
                      {product.title}
                    </h4>
                    <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                      {product.brand === 'primediscreet' ? 'Prime Discreet' : 'EntizNet Store'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold" style={{ color: theme.colors.accent }}>
                    ${product.revenue.toFixed(2)}
                  </p>
                  <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                    {product.orders} orders
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-4" style={{ color: theme.colors.accent }}>📊</div>
            <p style={{ color: theme.colors.text.secondary }}>
              {brand === 'primediscreet' 
                ? 'Elite analytics will appear once you have orders'
                : 'Analytics will show once you have sales data'
              }
            </p>
          </div>
        )}
      </div>

      {/* Recent Review Insights */}
      {reviews.length > 0 && (
        <div className="p-6 rounded-lg" style={{ 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border 
        }}>
          <h3 className="text-xl font-semibold mb-6" style={{ color: theme.colors.text.primary }}>
            Customer Feedback Analysis
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rating Distribution */}
            <div>
              <h4 className="font-medium mb-4" style={{ color: theme.colors.text.primary }}>
                Rating Distribution
              </h4>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map(rating => {
                  const count = reviews.filter(r => r.rating === rating).length
                  const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0
                  
                  return (
                    <div key={rating} className="flex items-center space-x-3">
                      <span className="w-8 text-sm" style={{ color: theme.colors.text.secondary }}>
                        {rating}⭐
                      </span>
                      <div className="flex-1 h-2 rounded overflow-hidden"
                           style={{ backgroundColor: theme.colors.background }}>
                        <div 
                          className="h-full transition-all"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: theme.colors.accent
                          }}
                        />
                      </div>
                      <span className="w-12 text-sm text-right" style={{ color: theme.colors.text.secondary }}>
                        {count}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Recent Reviews */}
            <div>
              <h4 className="font-medium mb-4" style={{ color: theme.colors.text.primary }}>
                Recent Feedback
              </h4>
              <div className="space-y-3">
                {reviews.slice(0, 3).map(review => (
                  <div key={review.id} className="p-3 rounded border"
                       style={{ borderColor: theme.colors.glass.border }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex text-yellow-400">
                        {Array.from({ length: 5 }, (_, i) => (
                          <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-gray-300'}>
                            ⭐
                          </span>
                        ))}
                      </div>
                      <span className="text-xs" style={{ color: theme.colors.text.secondary }}>
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: theme.colors.text.primary }}>
                      {review.title || review.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}