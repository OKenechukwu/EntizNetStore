'use client'

import { useBrand } from '@/components/BrandProvider'

interface PaymentStatusProps {
  status: string
  amount: number
  paymentMethod?: string
  createdAt: string
  escrowReleaseDate?: string
}

export default function PaymentStatus({ 
  status, 
  amount, 
  paymentMethod, 
  createdAt, 
  escrowReleaseDate 
}: PaymentStatusProps) {
  const { brand, theme } = useBrand()

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return {
          color: '#FFC107',
          label: 'Pending Payment',
          icon: '⏳',
          description: 'Awaiting payment confirmation'
        }
      case 'confirmed':
        return {
          color: '#28A745',
          label: 'Payment Confirmed',
          icon: '✅',
          description: 'Payment received and confirmed'
        }
      case 'processing':
        return {
          color: '#17A2B8',
          label: 'Processing',
          icon: '🔄',
          description: 'Order is being prepared'
        }
      case 'shipped':
        return {
          color: '#6F42C1',
          label: 'Shipped',
          icon: '📦',
          description: 'Order has been shipped'
        }
      case 'delivered':
        return {
          color: '#20C997',
          label: 'Delivered',
          icon: '🎉',
          description: 'Order successfully delivered'
        }
      case 'failed':
        return {
          color: '#DC3545',
          label: 'Payment Failed',
          icon: '❌',
          description: 'Payment could not be processed'
        }
      case 'cancelled':
        return {
          color: '#6C757D',
          label: 'Cancelled',
          icon: '🚫',
          description: 'Order was cancelled'
        }
      case 'refunded':
        return {
          color: '#FD7E14',
          label: 'Refunded',
          icon: '↩️',
          description: 'Payment has been refunded'
        }
      default:
        return {
          color: theme.colors.text.secondary,
          label: status,
          icon: '❓',
          description: 'Unknown status'
        }
    }
  }

  const statusConfig = getStatusConfig(status)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDaysUntilRelease = (releaseDate: string) => {
    const days = Math.ceil((new Date(releaseDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, days)
  }

  return (
    <div className="p-6 rounded-lg border" style={{ 
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.glass.border 
    }}>
      {/* Status Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="text-2xl">{statusConfig.icon}</div>
        <div>
          <h3 className="font-semibold text-lg" style={{ color: theme.colors.text.primary }}>
            {statusConfig.label}
          </h3>
          <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
            {statusConfig.description}
          </p>
        </div>
        <div 
          className="ml-auto px-3 py-1 rounded-full text-sm font-medium"
          style={{ 
            backgroundColor: statusConfig.color + '20',
            color: statusConfig.color
          }}
        >
          {statusConfig.label}
        </div>
      </div>

      {/* Payment Details */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span style={{ color: theme.colors.text.secondary }}>Amount</span>
          <span className="font-semibold text-lg" style={{ color: theme.colors.accent }}>
            ${amount.toFixed(2)}
          </span>
        </div>

        {paymentMethod && (
          <div className="flex justify-between items-center">
            <span style={{ color: theme.colors.text.secondary }}>Payment Method</span>
            <span style={{ color: theme.colors.text.primary }}>
              {paymentMethod}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span style={{ color: theme.colors.text.secondary }}>Order Date</span>
          <span style={{ color: theme.colors.text.primary }}>
            {formatDate(createdAt)}
          </span>
        </div>

        {/* Escrow Information */}
        {(status === 'confirmed' || status === 'processing' || status === 'shipped') && escrowReleaseDate && (
          <div className="mt-4 p-4 rounded border-l-4" style={{ 
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.accent
          }}>
            <div className="flex items-start gap-3">
              <div className="text-lg">🔒</div>
              <div>
                <h4 className="font-medium" style={{ color: theme.colors.text.primary }}>
                  {brand === 'primediscreet' ? 'Elite Escrow Protection' : 'Escrow Protection Active'}
                </h4>
                <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
                  {brand === 'primediscreet' 
                    ? 'Your payment is secured with elite-grade protection. Funds will be released to the seller after delivery confirmation.'
                    : 'Your payment is held securely until delivery is confirmed. This protects both you and the seller.'
                  }
                </p>
                
                {getDaysUntilRelease(escrowReleaseDate) > 0 ? (
                  <div className="mt-2 text-sm">
                    <span style={{ color: theme.colors.accent }}>
                      Funds release in {getDaysUntilRelease(escrowReleaseDate)} days
                    </span>
                    <span className="mx-2">•</span>
                    <span style={{ color: theme.colors.text.secondary }}>
                      {formatDate(escrowReleaseDate)}
                    </span>
                  </div>
                ) : (
                  <div className="mt-2 text-sm" style={{ color: '#28A745' }}>
                    ✅ Escrow period complete - funds available for seller
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success Message for Completed Orders */}
        {status === 'delivered' && (
          <div className="mt-4 p-4 rounded" style={{ 
            backgroundColor: '#28A745' + '10',
            border: `1px solid #28A745`
          }}>
            <div className="flex items-center gap-2 text-green-700">
              <span className="text-lg">🎉</span>
              <span className="font-medium">
                {brand === 'primediscreet' 
                  ? 'Elite transaction completed successfully!'
                  : 'Order completed successfully!'
                }
              </span>
            </div>
          </div>
        )}

        {/* Failed Payment Message */}
        {status === 'failed' && (
          <div className="mt-4 p-4 rounded" style={{ 
            backgroundColor: '#DC3545' + '10',
            border: `1px solid #DC3545`
          }}>
            <div className="flex items-center gap-2 text-red-700">
              <span className="text-lg">❌</span>
              <span className="font-medium">
                Payment could not be processed. Please try again or contact support.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {status === 'pending_payment' && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: theme.colors.glass.border }}>
          <button
            className="w-full py-3 rounded-lg font-medium transition-all"
            style={{
              backgroundColor: theme.colors.accent,
              color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
            }}
          >
            {brand === 'primediscreet' ? 'Complete Elite Payment' : 'Complete Payment'}
          </button>
        </div>
      )}

      {status === 'failed' && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: theme.colors.glass.border }}>
          <button
            className="w-full py-3 rounded-lg font-medium transition-all"
            style={{
              backgroundColor: theme.colors.accent,
              color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
            }}
          >
            Retry Payment
          </button>
        </div>
      )}
    </div>
  )
}