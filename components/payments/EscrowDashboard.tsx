'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { getSupabaseClient } from '@/lib/supabase/client'

interface EscrowDashboardProps {
  sellerId: string
}

export default function EscrowDashboard({ sellerId }: EscrowDashboardProps) {
  const { brand, theme } = useBrand()
  const [escrowRecords, setEscrowRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [requestingPayout, setRequestingPayout] = useState(false)
  const supabase = getSupabaseClient()

  useEffect(() => {
    loadEscrowData()
  }, [sellerId])

  const loadEscrowData = async () => {
    try {
      const { data, error } = await supabase
        .from('escrow')
        .select(`
          *,
          orders (
            id,
            product_id,
            quantity,
            total_cents,
            status,
            created_at,
            products (
              title,
              marketplace_brand
            )
          )
        `)
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setEscrowRecords(data || [])
    } catch (error) {
      console.error('Error loading escrow data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateEscrowSummary = () => {
    const summary = {
      totalHeld: 0,
      availableForPayout: 0,
      transferred: 0,
      platformFees: 0,
      pendingReleaseCount: 0
    }

    escrowRecords.forEach(record => {
      summary.platformFees += record.platform_fee_cents / 100

      switch (record.status) {
        case 'held':
          summary.totalHeld += record.amount_cents / 100
          if (new Date(record.expected_release_date) <= new Date()) {
            summary.availableForPayout += record.amount_cents / 100
          } else {
            summary.pendingReleaseCount++
          }
          break
        case 'transferred':
        case 'paid_out':
          summary.transferred += record.amount_cents / 100
          break
      }
    })

    return summary
  }

  const requestPayout = async () => {
    setRequestingPayout(true)
    
    try {
      const response = await fetch('/api/payments/request-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller_id: sellerId })
      })

      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error)
      }

      alert(brand === 'primediscreet' 
        ? 'Elite payout request submitted successfully!' 
        : 'Payout request submitted successfully!'
      )
      
      loadEscrowData()
    } catch (error: any) {
      alert(`Payout request failed: ${error.message}`)
    } finally {
      setRequestingPayout(false)
    }
  }

  const summary = calculateEscrowSummary()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'held': return '#FFC107'
      case 'transferred': return '#28A745' 
      case 'paid_out': return '#17A2B8'
      default: return theme.colors.text.secondary
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'held': return 'In Escrow'
      case 'transferred': return 'Transferred'
      case 'paid_out': return 'Paid Out'
      default: return status
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-current border-t-transparent rounded-full"
             style={{ color: theme.colors.accent }}></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Escrow Dashboard' : 'Escrow & Payouts'}
        </h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-lg" style={{ 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border 
        }}>
          <h3 className="font-medium mb-2" style={{ color: theme.colors.text.secondary }}>
            Available for Payout
          </h3>
          <p className="text-3xl font-bold" style={{ color: theme.colors.accent }}>
            ${summary.availableForPayout.toFixed(2)}
          </p>
          <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
            Ready to withdraw
          </p>
        </div>

        <div className="p-6 rounded-lg" style={{ 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border 
        }}>
          <h3 className="font-medium mb-2" style={{ color: theme.colors.text.secondary }}>
            In Escrow
          </h3>
          <p className="text-3xl font-bold" style={{ color: theme.colors.text.primary }}>
            ${summary.totalHeld.toFixed(2)}
          </p>
          <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
            {summary.pendingReleaseCount} pending release
          </p>
        </div>

        <div className="p-6 rounded-lg" style={{ 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border 
        }}>
          <h3 className="font-medium mb-2" style={{ color: theme.colors.text.secondary }}>
            Total Transferred
          </h3>
          <p className="text-3xl font-bold" style={{ color: theme.colors.text.primary }}>
            ${summary.transferred.toFixed(2)}
          </p>
          <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
            All time payouts
          </p>
        </div>

        <div className="p-6 rounded-lg" style={{ 
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border 
        }}>
          <h3 className="font-medium mb-2" style={{ color: theme.colors.text.secondary }}>
            Platform Fees
          </h3>
          <p className="text-3xl font-bold" style={{ color: theme.colors.text.primary }}>
            ${summary.platformFees.toFixed(2)}
          </p>
          <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
            {brand === 'primediscreet' ? '8% elite rate' : '10% standard rate'}
          </p>
        </div>
      </div>

      {/* Payout Actions */}
      {summary.availableForPayout > 0 && (
        <div className="p-6 rounded-lg border-2 border-dashed"
             style={{ 
               borderColor: theme.colors.accent,
               backgroundColor: theme.colors.surface 
             }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
                {brand === 'primediscreet' ? 'Elite Payout Available' : 'Payout Available'}
              </h3>
              <p style={{ color: theme.colors.text.secondary }}>
                ${summary.availableForPayout.toFixed(2)} ready for withdrawal
              </p>
            </div>
            <button
              onClick={requestPayout}
              disabled={requestingPayout}
              className="px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
              style={{
                backgroundColor: theme.colors.accent,
                color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
              }}
            >
              {requestingPayout ? 'Processing...' : 
               (brand === 'primediscreet' ? 'Request Elite Payout' : 'Request Payout')}
            </button>
          </div>
        </div>
      )}

      {/* Escrow Records Table */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold" style={{ color: theme.colors.text.primary }}>
          Escrow Transaction History
        </h3>
        
        {escrowRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: theme.colors.glass.border }}>
                  <th className="text-left py-3 px-4" style={{ color: theme.colors.text.primary }}>
                    Order
                  </th>
                  <th className="text-left py-3 px-4" style={{ color: theme.colors.text.primary }}>
                    Product
                  </th>
                  <th className="text-left py-3 px-4" style={{ color: theme.colors.text.primary }}>
                    Amount
                  </th>
                  <th className="text-left py-3 px-4" style={{ color: theme.colors.text.primary }}>
                    Status
                  </th>
                  <th className="text-left py-3 px-4" style={{ color: theme.colors.text.primary }}>
                    Release Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {escrowRecords.map(record => (
                  <tr key={record.id} className="border-b hover:bg-opacity-50 transition-colors"
                      style={{ 
                        borderColor: theme.colors.glass.border,
                        backgroundColor: 'transparent'
                      }}>
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium" style={{ color: theme.colors.text.primary }}>
                          #{record.orders?.id?.slice(-8)}
                        </div>
                        <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
                          {new Date(record.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <div style={{ color: theme.colors.text.primary }}>
                          {record.orders?.products?.title}
                        </div>
                        <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
                          {record.orders?.products?.marketplace_brand === 'primediscreet' 
                            ? 'Prime Discreet' 
                            : 'EntizNet Store'
                          }
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium" style={{ color: theme.colors.accent }}>
                          ${(record.amount_cents / 100).toFixed(2)}
                        </div>
                        <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
                          Fee: ${(record.platform_fee_cents / 100).toFixed(2)}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span 
                        className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{ 
                          backgroundColor: getStatusColor(record.status) + '20',
                          color: getStatusColor(record.status)
                        }}
                      >
                        {getStatusLabel(record.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div style={{ color: theme.colors.text.primary }}>
                        {record.expected_release_date 
                          ? new Date(record.expected_release_date).toLocaleDateString()
                          : 'Released'
                        }
                      </div>
                      {record.status === 'held' && record.expected_release_date && (
                        <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
                          {new Date(record.expected_release_date) <= new Date() 
                            ? 'Available now' 
                            : `${Math.ceil((new Date(record.expected_release_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days`
                          }
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-4xl mb-4" style={{ color: theme.colors.accent }}>💰</div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
              No escrow records yet
            </h3>
            <p style={{ color: theme.colors.text.secondary }}>
              {brand === 'primediscreet' 
                ? 'Elite transactions will appear here once you make sales'
                : 'Escrow transactions will appear here once you make sales'
              }
            </p>
          </div>
        )}
      </div>

      {/* Escrow Information */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.background }}>
        <h4 className="font-medium mb-2" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Escrow Protection' : 'How Escrow Works'}
        </h4>
        <div className="text-sm space-y-1" style={{ color: theme.colors.text.secondary }}>
          <p>• <strong>Security:</strong> Funds are held safely until order completion</p>
          <p>• <strong>Release:</strong> Money becomes available {brand === 'primediscreet' ? '3 days' : '7 days'} after delivery</p>
          <p>• <strong>Protection:</strong> Both buyers and sellers are protected from disputes</p>
          <p>• <strong>Payouts:</strong> Request withdrawals when funds are available</p>
          {brand === 'primediscreet' && (
            <p>• <strong>Elite Benefits:</strong> Faster releases, lower fees, priority support</p>
          )}
        </div>
      </div>
    </div>
  )
}