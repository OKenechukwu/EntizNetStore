import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId, action, trackingNumber, shippingCarrier } = await request.json()

    if (!orderId || !action) {
      return NextResponse.json({ 
        error: 'Order ID and action are required' 
      }, { status: 400 })
    }

    // Verify user owns this order (seller)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('seller_id', user.id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ 
        error: 'Order not found or access denied' 
      }, { status: 404 })
    }

    let updateData: any = {}
    
    switch (action) {
      case 'start_processing':
        updateData = {
          status: 'processing',
          fulfillment_status: 'unfulfilled',
          updated_at: new Date().toISOString()
        }
        break
        
      case 'mark_shipped':
        if (!trackingNumber || !shippingCarrier) {
          return NextResponse.json({ 
            error: 'Tracking number and shipping carrier are required for shipping' 
          }, { status: 400 })
        }
        updateData = {
          status: 'shipped',
          fulfillment_status: 'fulfilled',
          tracking_number: trackingNumber,
          shipping_carrier: shippingCarrier,
          shipped_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        // Update order items to fulfilled
        await supabase
          .from('order_items')
          .update({ fulfillment_status: 'fulfilled' })
          .eq('order_id', orderId)
        break
        
      case 'mark_delivered':
        updateData = {
          status: 'delivered',
          fulfillment_status: 'fulfilled',
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        // Release escrow funds when delivered
        await supabase
          .from('escrow_transactions')
          .update({ 
            status: 'released',
            released_at: new Date().toISOString(),
            release_reason: 'Order delivered successfully'
          })
          .eq('order_id', orderId)
        break
        
      case 'cancel_order':
        updateData = {
          status: 'cancelled',
          fulfillment_status: 'unfulfilled',
          updated_at: new Date().toISOString()
        }
        
        // Handle escrow refund if payment was made
        if (order.payment_status === 'paid') {
          await supabase
            .from('escrow_transactions')
            .update({ 
              status: 'refunded',
              released_at: new Date().toISOString(),
              release_reason: 'Order cancelled by seller'
            })
            .eq('order_id', orderId)
        }
        break
        
      default:
        return NextResponse.json({ 
          error: 'Invalid action' 
        }, { status: 400 })
    }

    // Update the order
    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)

    if (updateError) {
      console.error('Error updating order:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update order' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Order status updated successfully'
    })

  } catch (error) {
    console.error('Error in fulfillment endpoint:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}