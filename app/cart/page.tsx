'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import Link from 'next/link'
import { getCart, setQty, removeItem, clearCart, subtotalBase, type CartItem } from '@/lib/cart'
import Price from '@/components/common/Price'

export default function CartPage() {
  const { theme, brand } = useBrand()
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setCart(getCart())
    setLoading(false)
  }, [])

  const handleQuantityChange = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return
    setQty(id, newQuantity)
    setCart(getCart())
  }

  const handleRemoveItem = (id: string) => {
    removeItem(id)
    setCart(getCart())
  }

  const handleClearCart = () => {
    clearCart()
    setCart([])
  }

  const subtotal = subtotalBase()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.colors.background }}>
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 rounded-full mb-4 mx-auto"
               style={{ 
                 borderColor: theme.colors.glass.border,
                 borderTopColor: theme.colors.accent 
               }}></div>
          <p style={{ color: theme.colors.text.secondary }}>Loading cart...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.colors.background }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl md:text-4xl font-bold" style={{ color: theme.colors.text.primary }}>
            Shopping Cart
          </h1>
          <Link 
            href="/store"
            className="text-sm hover:opacity-70 transition-colors"
            style={{ color: theme.colors.accent }}
          >
            ← Continue Shopping
          </Link>
        </div>

        {cart.length === 0 ? (
          /* Empty Cart */
          <div className="text-center py-16">
            <div className="text-6xl mb-6" style={{ color: theme.colors.accent }}>
              🛒
            </div>
            <h2 className="text-2xl font-bold mb-4" style={{ color: theme.colors.text.primary }}>
              Your Cart is Empty
            </h2>
            <p className="text-lg mb-8 max-w-md mx-auto" style={{ color: theme.colors.text.secondary }}>
              {brand === 'primediscreet' 
                ? 'Discover our exclusive luxury collection and find something special.'
                : 'Browse our premium products and add items you love to your cart.'
              }
            </p>
            <Link
              href="/store"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-medium transition-all hover:opacity-90"
              style={{
                backgroundColor: theme.colors.accent,
                color: brand === 'primediscreet' ? theme.colors.background : 'white'
              }}
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          /* Cart with Items */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cart.map((item) => (
                <div key={item.id} 
                     className="border rounded-lg p-6 hover:shadow-md transition-shadow"
                     style={{ borderColor: theme.colors.glass.border }}>
                  
                  <div className="flex items-start gap-4">
                    
                    {/* Product Image */}
                    <div className="w-20 h-20 rounded-lg flex-shrink-0"
                         style={{ backgroundColor: theme.colors.surface }}>
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-2xl" style={{ color: theme.colors.accent }}>📦</span>
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-1" style={{ color: theme.colors.text.primary }}>
                        {item.title}
                      </h3>
                      <p className="text-sm mb-3" style={{ color: theme.colors.text.secondary }}>
                        ${item.priceBase} each
                      </p>
                      
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium" style={{ color: theme.colors.text.secondary }}>
                          Quantity:
                        </span>
                        <div className="flex items-center border rounded-lg"
                             style={{ borderColor: theme.colors.glass.border }}>
                          <button
                            onClick={() => handleQuantityChange(item.id, item.qty - 1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-opacity-10 transition-colors"
                            style={{ backgroundColor: theme.colors.surface }}
                            disabled={item.qty <= 1}
                          >
                            −
                          </button>
                          <span className="w-12 text-center font-medium" style={{ color: theme.colors.text.primary }}>
                            {item.qty}
                          </span>
                          <button
                            onClick={() => handleQuantityChange(item.id, item.qty + 1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-opacity-10 transition-colors"
                            style={{ backgroundColor: theme.colors.surface }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Price and Remove */}
                    <div className="text-right">
                      <p className="font-bold text-lg mb-2" style={{ color: theme.colors.accent }}>
                        <Price amount={item.priceBase * item.qty} />
                      </p>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-sm hover:opacity-70 transition-colors"
                        style={{ color: '#EF4444' }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Clear Cart */}
              <div className="text-right pt-4">
                <button
                  onClick={handleClearCart}
                  className="text-sm hover:opacity-70 transition-colors"
                  style={{ color: theme.colors.text.secondary }}
                >
                  Clear All Items
                </button>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="border rounded-lg p-6 sticky top-8"
                   style={{ borderColor: theme.colors.glass.border }}>
                
                <h3 className="text-xl font-bold mb-6" style={{ color: theme.colors.text.primary }}>
                  Order Summary
                </h3>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: theme.colors.text.secondary }}>
                      Items ({cart.reduce((total, item) => total + item.qty, 0)})
                    </span>
                    <span style={{ color: theme.colors.text.primary }}>
                      <Price amount={subtotal} />
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span style={{ color: theme.colors.text.secondary }}>Shipping</span>
                    <span style={{ color: '#10B981' }}>FREE</span>
                  </div>
                  
                  <div className="border-t pt-4" style={{ borderColor: theme.colors.glass.border }}>
                    <div className="flex justify-between text-lg font-bold">
                      <span style={{ color: theme.colors.text.primary }}>Total</span>
                      <span style={{ color: theme.colors.accent }}>
                        <Price amount={subtotal} />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Checkout Button */}
                <Link
                  href="/checkout"
                  className="w-full py-3 rounded-lg font-medium text-center block transition-all hover:opacity-90 mb-4"
                  style={{
                    backgroundColor: theme.colors.accent,
                    color: brand === 'primediscreet' ? theme.colors.background : 'white'
                  }}
                >
                  Proceed to Checkout
                </Link>

                {/* Security Features */}
                <div className="space-y-3 text-sm">
                  {[
                    { icon: '🔒', text: 'Secure SSL checkout' },
                    { icon: '🚚', text: 'Discreet packaging' },
                    { icon: '↩️', text: '30-day returns' }
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-2"
                         style={{ color: theme.colors.text.secondary }}>
                      <span>{feature.icon}</span>
                      <span>{feature.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}