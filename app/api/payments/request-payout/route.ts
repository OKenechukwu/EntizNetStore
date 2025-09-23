import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

export async function POST(request: NextRequest) {
  try {
    const { seller_id } = await request.json()

    // Verify authentication
    const supabase = createServerComponentClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify seller ownership
    if (session.user.id !== seller_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get available escrow records
    const { data: escrowRecords, error: escrowError } = await supabase
      .from('escrow')
      .select('*')
      .eq('seller_id', seller_id)
      .eq('status', 'held')
      .lte('expected_release_date', new Date().toISOString())

    if (escrowError) {
      throw new Error('Failed to fetch escrow records')
    }

    if (!escrowRecords || escrowRecords.length === 0) {
      return NextResponse.json({ error: 'No funds available for payout' }, { status: 400 })
    }

    // Calculate total available amount
    const totalAmount = escrowRecords.reduce((sum, record) => sum + record.amount_cents, 0)
    
    if (totalAmount < 5000) { // Minimum $50 payout
      return NextResponse.json({ 
        error: 'Minimum payout amount is $50.00' 
      }, { status: 400 })
    }

    // Get seller's Stripe account ID
    const { data: sellerProfile } = await supabase
      .from('profiles_seller')
      .select('stripe_account_id, marketplace_brand')
      .eq('id', seller_id)
      .single()

    if (!sellerProfile?.stripe_account_id) {
      return NextResponse.json({ 
        error: 'Stripe account not connected. Please complete seller onboarding.' 
      }, { status: 400 })
    }

    try {
      // Create transfer to seller's connected account
      const transfer = await stripe.transfers.create({
        amount: totalAmount,
        currency: 'usd',
        destination: sellerProfile.stripe_account_id,
        metadata: {
          seller_id: seller_id,
          payout_request: 'true',
          marketplace_brand: sellerProfile.marketplace_brand || 'entiznetstore',
          escrow_record_count: escrowRecords.length.toString()
        }
      })

      // Update escrow records as transferred
      const escrowIds = escrowRecords.map(record => record.id)
      const { error: updateError } = await supabase
        .from('escrow')
        .update({
          status: 'transferred',
          transferred_at: new Date().toISOString(),
          stripe_transfer_id: transfer.id
        })
        .in('id', escrowIds)

      if (updateError) {
        console.error('Error updating escrow records:', updateError)
        // Continue anyway, webhook will handle the update
      }

      // Create payout record for tracking
      const { error: payoutError } = await supabase
        .from('seller_payouts')
        .insert({
          seller_id: seller_id,
          amount_cents: totalAmount,
          stripe_transfer_id: transfer.id,
          status: 'completed',
          escrow_record_ids: escrowIds,
          requested_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })

      if (payoutError) {
        console.error('Error creating payout record:', payoutError)
      }

      return NextResponse.json({
        success: true,
        transfer_id: transfer.id,
        amount: totalAmount / 100,
        message: 'Payout request processed successfully'
      })

    } catch (stripeError: any) {
      console.error('Stripe transfer error:', stripeError)
      return NextResponse.json(
        { error: `Payout failed: ${stripeError.message}` },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Payout request error:', error)
    return NextResponse.json(
      { error: error.message || 'Payout request failed' },
      { status: 500 }
    )
  }
}