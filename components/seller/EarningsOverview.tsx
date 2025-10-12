'use client'

import { useBrand } from '@/components/BrandProvider'
import Price from '@/components/ui/Price'

interface EarningsOverviewProps {
  orders: any[]
}

export default function EarningsOverview({ orders }: EarningsOverviewProps) {
  const { brand, theme } = useBrand()

  // Calculate earnings
  const totalEarnings = orders.reduce((sum, order) => sum + (order.total_cents / 100), 0)
  const pendingEarnings = orders
    .filter(order => ['pending', 'confirmed', 'processing'].includes(order.status))
    .reduce((sum, order) => sum + (order.total_cents / 100), 0)
  const availableEarnings = orders
    .filter(order => ['delivered'].includes(order.status))
    .reduce((sum, order) => sum + (order.total_cents / 100), 0)

  // Monthly breakdown
  const monthlyEarnings = Array.from({ length: 6 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const month = date.getMonth()
    const year = date.getFullYear()
    
    const monthOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at)
      return orderDate.getMonth() === month && orderDate.getFullYear() === year
    })
    
    return {
      month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      earnings: monthOrders.reduce((sum, order) => sum + (order.total_cents / 100), 0),
      orders: monthOrders.length
    }
  }).reverse()

  // Platform fees (simplified calculation)
  const platformFeeRate = brand === 'primediscreet' ? 0.08 : 0.10 // 8% for premium, 10% for standard
  const platformFees = totalEarnings * platformFeeRate
  const netEarnings = totalEarnings - platformFees

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Earnings Overview' : 'Earnings Overview'}
        </h2>
        <button 
          className="px-4 py-2 rounded-lg font-medium transition-all"
          style={{
            backgroundColor: theme.colors.accent,
            color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
          }}
        >
          Request Payout
        </button>
      </div>

      {/* Earnings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-lg" style={{ 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border 
        }}>
          <h3 className="font-medium mb-2" style={{ color: theme.colors.text.secondary }}>
            Available for Payout
          </h3>
          <p className="text-3xl font-bold" style={{ color: theme.colors.accent }}>
            <Price amount={availableEarnings} />
          </p>
          <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
            From completed orders
          </p>
        </div>

        <div className="p-6 rounded-lg" style={{ 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border 
        }}>
          <h3 className="font-medium mb-2" style={{ color: theme.colors.text.secondary }}>
            Pending Earnings
          </h3>
          <p className="text-3xl font-bold" style={{ color: theme.colors.text.primary }}>
            <Price amount={pendingEarnings} />
          </p>
          <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
            From processing orders
          </p>
        </div>

        <div className="p-6 rounded-lg" style={{ 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border 
        }}>
          <h3 className="font-medium mb-2" style={{ color: theme.colors.text.secondary }}>
            Total Gross Revenue
          </h3>
          <p className="text-3xl font-bold" style={{ color: theme.colors.text.primary }}>
            <Price amount={totalEarnings} />
          </p>
          <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
            All time
          </p>
        </div>
      </div>

      {/* Fee Breakdown */}
      <div className="p-6 rounded-lg" style={{ 
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.glass.border 
      }}>
        <h3 className="text-xl font-semibold mb-6" style={{ color: theme.colors.text.primary }}>
          Revenue Breakdown
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded"
               style={{ backgroundColor: theme.colors.background }}>
            <span style={{ color: theme.colors.text.primary }}>Gross Revenue</span>
            <span className="font-bold" style={{ color: theme.colors.text.primary }}>
              <Price amount={totalEarnings} />
            </span>
          </div>
          
          <div className="flex items-center justify-between p-4 rounded"
               style={{ backgroundColor: theme.colors.background }}>
            <span style={{ color: theme.colors.text.secondary }}>
              Platform Fee ({(platformFeeRate * 100).toFixed(0)}%)
              {brand === 'primediscreet' && (
                <span className="ml-2 text-xs px-2 py-1 rounded"
                      style={{ 
                        backgroundColor: theme.colors.accent,
                        color: theme.colors.background 
                      }}>
                  ELITE RATE
                </span>
              )}
            </span>
            <span style={{ color: theme.colors.text.secondary }}>
              -<Price amount={platformFees} />
            </span>
          </div>
          
          <div className="border-t pt-4" style={{ borderColor: theme.colors.glass.border }}>
            <div className="flex items-center justify-between">
              <span className="font-semibold" style={{ color: theme.colors.text.primary }}>
                Net Earnings
              </span>
              <span className="font-bold text-lg" style={{ color: theme.colors.accent }}>
                <Price amount={netEarnings} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Earnings Chart */}
      <div className="p-6 rounded-lg" style={{ 
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.glass.border 
      }}>
        <h3 className="text-xl font-semibold mb-6" style={{ color: theme.colors.text.primary }}>
          Monthly Earnings Trend
        </h3>
        
        <div className="space-y-4">
          {monthlyEarnings.map((month, index) => {
            const maxEarnings = Math.max(...monthlyEarnings.map(m => m.earnings))
            const percentage = maxEarnings > 0 ? (month.earnings / maxEarnings) * 100 : 0
            
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium" style={{ color: theme.colors.text.primary }}>
                    {month.month}
                  </span>
                  <div className="text-right">
                    <span className="font-bold" style={{ color: theme.colors.accent }}>
                      <Price amount={month.earnings} />
                    </span>
                    <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
                      {month.orders} orders
                    </div>
                  </div>
                </div>
                <div className="w-full h-2 rounded overflow-hidden"
                     style={{ backgroundColor: theme.colors.background }}>
                  <div 
                    className="h-full transition-all"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: theme.colors.accent
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Payout Information */}
      <div className="p-6 rounded-lg border-2 border-dashed"
           style={{ 
             borderColor: theme.colors.glass.border,
             backgroundColor: theme.colors.surface 
           }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Payout Information' : 'Payout Information'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2" style={{ color: theme.colors.text.primary }}>
              Payout Schedule
            </h4>
            <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
              {brand === 'primediscreet' 
                ? 'Weekly payouts for elite sellers (Mondays)'
                : 'Bi-weekly payouts (1st and 15th of each month)'
              }
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-2" style={{ color: theme.colors.text.primary }}>
              Minimum Payout
            </h4>
            <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
              {brand === 'primediscreet' ? <><Price amount={50} /> minimum</> : <><Price amount={100} /> minimum</>}
            </p>
          </div>
        </div>
        
        <div className="mt-4 p-4 rounded" style={{ backgroundColor: theme.colors.background }}>
          <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
            <strong>Note:</strong> Earnings from completed orders are available for payout after a 
            {brand === 'primediscreet' ? ' 3-day' : ' 7-day'} holding period to ensure transaction security.
          </p>
        </div>
      </div>
    </div>
  )
}