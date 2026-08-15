import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Lazy init: constructing Stripe at module scope crashes the production
// build (page-data collection) when STRIPE_SECRET_KEY is not configured.
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key, {
    apiVersion: '2025-08-27.basil'
  })
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const supabase = createServerComponentClient({ cookies })

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent, supabase)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent, supabase)
        break

      case 'transfer.created':
        await handleTransferCreated(event.data.object as Stripe.Transfer, supabase)
        break

      case 'payout.paid':
        await handlePayoutPaid(event.data.object as Stripe.Payout, supabase)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  try {
    // Update order status
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'confirmed',
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntent.id
      })
      .eq('stripe_payment_intent_id', paymentIntent.id)

    if (orderError) {
      console.error('Error updating order:', orderError)
      return
    }

    // Create escrow record for seller payout tracking
    const platformFeeAmount = parseInt(paymentIntent.metadata?.platform_fee_amount || '0')
    const sellerAmount = paymentIntent.amount - platformFeeAmount

    const { error: escrowError } = await supabase
      .from('escrow')
      .insert({
        order_id: paymentIntent.metadata?.order_id,
        seller_id: paymentIntent.metadata?.seller_id,
        amount_cents: sellerAmount,
        platform_fee_cents: platformFeeAmount,
        status: 'held',
        stripe_payment_intent_id: paymentIntent.id,
        expected_release_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })

    if (escrowError) {
      console.error('Error creating escrow record:', escrowError)
    }

    // Update product inventory if tracking
    if (paymentIntent.metadata?.product_id && paymentIntent.metadata?.variant_id) {
      const quantity = parseInt(paymentIntent.metadata?.quantity || '1')
      
      const { error: inventoryError } = await supabase
        .from('product_variants')
        .update({
          inventory_quantity: supabase.sql`inventory_quantity - ${quantity}`
        })
        .eq('id', paymentIntent.metadata.variant_id)
        .eq('product_id', paymentIntent.metadata.product_id)

      if (inventoryError) {
        console.error('Error updating inventory:', inventoryError)
      }
    }

    console.log('Payment succeeded and order updated:', paymentIntent.id)

  } catch (error) {
    console.error('Error handling payment success:', error)
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent, supabase: any) {
  try {
    // Update order status to failed
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_payment_intent_id', paymentIntent.id)

    if (error) {
      console.error('Error updating failed order:', error)
    }

    console.log('Payment failed for:', paymentIntent.id)

  } catch (error) {
    console.error('Error handling payment failure:', error)
  }
}

async function handleTransferCreated(transfer: Stripe.Transfer, supabase: any) {
  try {
    // Update escrow record when transfer is created
    const { error } = await supabase
      .from('escrow')
      .update({
        stripe_transfer_id: transfer.id,
        status: 'transferred',
        transferred_at: new Date().toISOString()
      })
      .eq('stripe_payment_intent_id', transfer.source_transaction)

    if (error) {
      console.error('Error updating escrow transfer:', error)
    }

    console.log('Transfer created:', transfer.id)

  } catch (error) {
    console.error('Error handling transfer creation:', error)
  }
}

async function handlePayoutPaid(payout: Stripe.Payout, supabase: any) {
  try {
    // This could be used to track when sellers actually receive their money
    console.log('Payout paid:', payout.id)

  } catch (error) {
    console.error('Error handling payout:', error)
  }
}