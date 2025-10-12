'use client'

import { useState } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { useTranslation } from '@/hooks/useTranslation'
import Price from '@/components/ui/Price'

interface ProductDetailsTabsProps {
  product: {
    id: string
    title: string | null
    description: string | null
    price: number | null
    specifications?: string | null
    certification?: string | null
    warranty?: string | null
    expiryDate?: string | null
  }
}

export default function ProductDetailsTabs({ product }: ProductDetailsTabsProps) {
  const { theme } = useBrand()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('description')

  const tabs = [
    { id: 'description', label: t('description') },
    { id: 'specifications', label: t('specifications') },
    { id: 'certification', label: 'Certification' },
    { id: 'warranty', label: 'Warranty' },
    { id: 'expiry', label: 'Expiry On' },
    { id: 'store-policy', label: 'Store Policy' },
    { id: 'escrow-policy', label: 'Escrow Policy' }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'description':
        return (
          <div className="prose max-w-none">
            <p className="whitespace-pre-wrap" style={{ color: theme.colors.text.primary }}>
              {product.description || 'No description provided.'}
            </p>
          </div>
        )
      
      case 'specifications':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
              Product Specifications
            </h3>
            <div className="space-y-2" style={{ color: theme.colors.text.secondary }}>
              {product.specifications ? (
                <p className="whitespace-pre-wrap">{product.specifications}</p>
              ) : (
                <div className="space-y-2">
                  <p><strong>Material:</strong> Premium medical-grade silicone</p>
                  <p><strong>Dimensions:</strong> Length: 6.5" | Width: 1.2" | Height: 1.2"</p>
                  <p><strong>Weight:</strong> 4.2 oz</p>
                  <p><strong>Power Source:</strong> USB rechargeable lithium battery</p>
                  <p><strong>Battery Life:</strong> Up to 2 hours continuous use</p>
                  <p><strong>Waterproof Rating:</strong> IPX7 - fully submersible</p>
                  <p><strong>Vibration Patterns:</strong> 10 unique patterns with 5 intensity levels</p>
                  <p><strong>Noise Level:</strong> &lt;50dB whisper-quiet operation</p>
                </div>
              )}
            </div>
          </div>
        )
      
      case 'certification':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
              Certifications & Safety
            </h3>
            <div className="space-y-3" style={{ color: theme.colors.text.secondary }}>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span><strong>FDA Certified:</strong> Medical-grade materials approved for body contact</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span><strong>CE Marking:</strong> Meets European health and safety standards</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span><strong>RoHS Compliant:</strong> Free from hazardous substances</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span><strong>ISO 10993:</strong> Biological evaluation for medical devices</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span><strong>Latex-Free:</strong> Hypoallergenic and safe for sensitive skin</span>
              </div>
            </div>
          </div>
        )
      
      case 'warranty':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
              Warranty Information
            </h3>
            <div className="space-y-3" style={{ color: theme.colors.text.secondary }}>
              <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.surface }}>
                <h4 className="font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
                  2-Year Limited Warranty
                </h4>
                <p>We stand behind the quality of our products with a comprehensive 2-year warranty covering manufacturing defects and normal wear.</p>
              </div>
              <div className="space-y-2">
                <p><strong>Coverage Includes:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Motor and electronic components</li>
                  <li>Charging port and cable</li>
                  <li>Manufacturing defects in materials</li>
                  <li>Free replacement within first year</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p><strong>Not Covered:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Damage from misuse or modification</li>
                  <li>Normal wear and tear of silicone surfaces</li>
                  <li>Damage from improper cleaning</li>
                  <li>Water damage from exceeding IPX7 limits</li>
                </ul>
              </div>
            </div>
          </div>
        )
      
      case 'expiry':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
              Product Expiry Information
            </h3>
            <div className="space-y-3" style={{ color: theme.colors.text.secondary }}>
              <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.surface }}>
                <p><strong>Recommended Usage Period:</strong> 3-5 years with proper care</p>
                {product.expiryDate && (
                  <p><strong>Expiry Date:</strong> {product.expiryDate}</p>
                )}
              </div>
              <div className="space-y-2">
                <p><strong>Lifespan Factors:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Frequency of use and cleaning</li>
                  <li>Storage conditions (temperature and humidity)</li>
                  <li>Quality of charging and maintenance</li>
                  <li>Exposure to extreme temperatures</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p><strong>Signs to Replace:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Visible cracks or tears in silicone</li>
                  <li>Decreased battery life or charging issues</li>
                  <li>Changes in texture or discoloration</li>
                  <li>Reduced motor performance</li>
                </ul>
              </div>
            </div>
          </div>
        )
      
      case 'store-policy':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
              Store Policy
            </h3>
            <div className="space-y-4" style={{ color: theme.colors.text.secondary }}>
              <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.surface }}>
                <h4 className="font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
                  Return Policy
                </h4>
                <p>30-day hassle-free returns for unopened items. Opened personal care items cannot be returned for health and safety reasons.</p>
              </div>
              
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>Shipping</h4>
                  <p>Discreet packaging with 2-3 business day delivery. Free shipping on orders over <Price amount={75} />.</p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>Privacy</h4>
                  <p>All orders ship in plain, unmarked packaging with no indication of contents. Your privacy is our priority.</p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>Age Verification</h4>
                  <p>You must be 18+ to purchase. Adult signature required for delivery confirmation.</p>
                </div>
              </div>
            </div>
          </div>
        )
      
      case 'escrow-policy':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
              Escrow Protection Policy
            </h3>
            <div className="space-y-4" style={{ color: theme.colors.text.secondary }}>
              <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.surface }}>
                <h4 className="font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
                  Secure Transaction Guarantee
                </h4>
                <p>Your payment is held in secure escrow until you confirm receipt and satisfaction with your order.</p>
              </div>
              
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>How It Works</h4>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>Your payment is securely held in escrow when you place your order</li>
                    <li>Seller ships your item with tracking confirmation</li>
                    <li>You receive and inspect your order</li>
                    <li>Payment is released to seller once you confirm satisfaction</li>
                  </ol>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>Dispute Resolution</h4>
                  <p>If there's an issue with your order, our escrow team will mediate and ensure fair resolution. Funds remain protected until disputes are resolved.</p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>Release Timeline</h4>
                  <p>You have 7 days after delivery to inspect and confirm your order. If no action is taken, payment is automatically released to the seller.</p>
                </div>
              </div>
            </div>
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="mt-8">
      {/* Tab Navigation */}
      <div className="border-b" style={{ borderColor: theme.colors.glass.border }}>
        <nav className="flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-current'
                  : 'border-transparent hover:border-current'
              }`}
              style={{
                color: activeTab === tab.id 
                  ? theme.colors.accent 
                  : theme.colors.text.secondary,
                borderBottomColor: activeTab === tab.id 
                  ? theme.colors.accent 
                  : 'transparent'
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="py-6">
        {renderTabContent()}
      </div>
    </div>
  )
}