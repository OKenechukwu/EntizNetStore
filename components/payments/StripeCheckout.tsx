'use client'

import { useState } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { getSupabaseClient } from '@/lib/supabase/client'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface CheckoutFormProps {
  product: any
  variant?: any
  quantity: number
  onSuccess: (paymentIntent: any) => void
  onError: (error: string) => void
}

function CheckoutForm({ product, variant, quantity, onSuccess, onError }: CheckoutFormProps) {
  const { brand, theme } = useBrand()
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [customerInfo, setCustomerInfo] = useState({
    email: '',
    name: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US'
    }
  })
  const supabase = getSupabaseClient()

  const calculateTotal = () => {
    const basePrice = variant?.price || product.base_price
    const subtotal = basePrice * quantity
    const tax = subtotal * 0.08 // 8% tax rate
    const shipping = product.requires_shipping ? 9.99 : 0
    return {
      subtotal,
      tax,
      shipping,
      total: subtotal + tax + shipping
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    
    if (!stripe || !elements) return

    setProcessing(true)

    try {
      const { total } = calculateTotal()
      
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Please sign in to complete your purchase')
      }

      // Create payment intent
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(total * 100), // Convert to cents
          currency: 'usd',
          metadata: {
            product_id: product.id,
            variant_id: variant?.id,
            quantity: quantity.toString(),
            buyer_id: session.user.id,
            seller_id: product.seller_id,
            marketplace_brand: product.marketplace_brand
          },
          customer_info: customerInfo,
          shipping_required: product.requires_shipping
        })
      })

      const { client_secret, error: apiError } = await response.json()
      
      if (apiError) {
        throw new Error(apiError)
      }

      // Confirm payment
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) throw new Error('Card element not found')

      const { error, paymentIntent } = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: customerInfo.name,
            email: customerInfo.email,
            address: customerInfo.address
          }
        }
      })

      if (error) {
        throw new Error(error.message || 'Payment failed')
      }

      if (paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent)
      }

    } catch (err: any) {
      onError(err.message || 'Payment failed')
    } finally {
      setProcessing(false)
    }
  }

  const totals = calculateTotal()

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: theme.colors.text.primary,
        backgroundColor: theme.colors.surface,
        '::placeholder': {
          color: theme.colors.text.secondary,
        },
      },
    },
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer Information */}
      <div>
        <h3 className="text-lg font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Customer Information' : 'Customer Information'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
              Email Address *
            </label>
            <input
              type="email"
              required
              value={customerInfo.email}
              onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
              Full Name *
            </label>
            <input
              type="text"
              required
              value={customerInfo.name}
              onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.glass.border,
                color: theme.colors.text.primary
              }}
            />
          </div>
        </div>
      </div>

      {/* Shipping Address */}
      {product.requires_shipping && (
        <div>
          <h3 className="text-lg font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
            Shipping Address
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                Address Line 1 *
              </label>
              <input
                type="text"
                required
                value={customerInfo.address.line1}
                onChange={(e) => setCustomerInfo(prev => ({ 
                  ...prev, 
                  address: { ...prev.address, line1: e.target.value }
                }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.glass.border,
                  color: theme.colors.text.primary
                }}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  City *
                </label>
                <input
                  type="text"
                  required
                  value={customerInfo.address.city}
                  onChange={(e) => setCustomerInfo(prev => ({ 
                    ...prev, 
                    address: { ...prev.address, city: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  State *
                </label>
                <input
                  type="text"
                  required
                  value={customerInfo.address.state}
                  onChange={(e) => setCustomerInfo(prev => ({ 
                    ...prev, 
                    address: { ...prev.address, state: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  ZIP Code *
                </label>
                <input
                  type="text"
                  required
                  value={customerInfo.address.postal_code}
                  onChange={(e) => setCustomerInfo(prev => ({ 
                    ...prev, 
                    address: { ...prev.address, postal_code: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Information */}
      <div>
        <h3 className="text-lg font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
          Payment Information
        </h3>
        
        <div className="p-4 border rounded-lg" style={{ borderColor: theme.colors.glass.border }}>
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      {/* Order Summary */}
      <div className="p-6 rounded-lg" style={{ backgroundColor: theme.colors.surface }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
          Order Summary
        </h3>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span style={{ color: theme.colors.text.primary }}>
              {product.title} {variant && `(${variant.title})`} × {quantity}
            </span>
            <span style={{ color: theme.colors.text.primary }}>
              ${totals.subtotal.toFixed(2)}
            </span>
          </div>
          
          {product.requires_shipping && (
            <div className="flex justify-between">
              <span style={{ color: theme.colors.text.secondary }}>Shipping</span>
              <span style={{ color: theme.colors.text.secondary }}>
                ${totals.shipping.toFixed(2)}
              </span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span style={{ color: theme.colors.text.secondary }}>Tax</span>
            <span style={{ color: theme.colors.text.secondary }}>
              ${totals.tax.toFixed(2)}
            </span>
          </div>
          
          <div className="border-t pt-2" style={{ borderColor: theme.colors.glass.border }}>
            <div className="flex justify-between font-semibold">
              <span style={{ color: theme.colors.text.primary }}>Total</span>
              <span style={{ color: theme.colors.accent }}>
                ${totals.total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full py-4 rounded-lg font-semibold text-lg transition-all disabled:opacity-50"
        style={{
          backgroundColor: theme.colors.accent,
          color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
        }}
      >
        {processing 
          ? 'Processing...' 
          : (brand === 'primediscreet' 
              ? `Complete Elite Purchase • $${totals.total.toFixed(2)}`
              : `Complete Purchase • $${totals.total.toFixed(2)}`
            )
        }
      </button>
      
      {/* Security Notice */}
      <div className="text-center text-sm" style={{ color: theme.colors.text.secondary }}>
        🔒 {brand === 'primediscreet' ? 'Elite-grade secure payment processing' : 'Secure payment processing'} by Stripe
        <br />
        {brand === 'primediscreet' ? 'Discrete billing and premium escrow protection' : 'Your payment information is protected'}
      </div>
    </form>
  )
}

interface StripeCheckoutProps {
  product: any
  variant?: any
  quantity: number
  onSuccess: (paymentIntent: any) => void
  onError: (error: string) => void
}

export default function StripeCheckout(props: StripeCheckoutProps) {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm {...props} />
    </Elements>
  )
}