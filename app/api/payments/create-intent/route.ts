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

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe()
    const body = await request.json()
    const { 
      amount, 
      currency = 'usd', 
      metadata, 
      customer_info, 
      shipping_required = false 
    } = body

    // Verify authentication
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate required fields
    if (!amount || amount < 50) { // Minimum $0.50
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Create or retrieve customer
    let customer
    if (customer_info?.email) {
      const existingCustomers = await stripe.customers.list({
        email: customer_info.email,
        limit: 1
      })

      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0]
      } else {
        customer = await stripe.customers.create({
          email: customer_info.email,
          name: customer_info.name,
          address: shipping_required ? customer_info.address : undefined,
          metadata: {
            user_id: user.id,
            marketplace_brand: metadata?.marketplace_brand || 'entiznetstore'
          }
        })
      }
    }

    // Calculate platform fee (8% for PrimeDiscreet, 10% for EntizNetStore)
    const platformFeeRate = metadata?.marketplace_brand === 'primediscreet' ? 0.08 : 0.10
    const platformFee = Math.round(amount * platformFeeRate)

    // Create payment intent with connect account for escrow
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customer?.id,
      metadata: {
        ...metadata,
        customer_id: customer?.id,
        user_id: user.id,
        platform_fee_amount: platformFee.toString()
      },
      application_fee_amount: platformFee,
      transfer_data: {
        destination: metadata?.seller_stripe_account_id || process.env.STRIPE_SELLER_ACCOUNT_ID!,
      },
      automatic_payment_methods: {
        enabled: true
      },
      shipping: shipping_required && customer_info?.address ? {
        name: customer_info.name,
        address: {
          line1: customer_info.address.line1,
          line2: customer_info.address.line2 || undefined,
          city: customer_info.address.city,
          state: customer_info.address.state,
          postal_code: customer_info.address.postal_code,
          country: customer_info.address.country || 'US'
        }
      } : undefined
    })

    // Create order record in database for tracking
    const { error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        seller_id: metadata?.seller_id,
        product_id: metadata?.product_id,
        variant_id: metadata?.variant_id || null,
        quantity: parseInt(metadata?.quantity || '1'),
        total_cents: amount,
        platform_fee_cents: platformFee,
        status: 'pending_payment',
        stripe_payment_intent_id: paymentIntent.id,
        marketplace_brand: metadata?.marketplace_brand || 'entiznetstore',
        shipping_required: shipping_required,
        shipping_address: shipping_required ? customer_info?.address : null
      })

    if (orderError) {
      console.error('Database error:', orderError)
      // Don't fail payment creation, but log the error
    }

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id
    })

  } catch (error: any) {
    console.error('Payment intent creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}