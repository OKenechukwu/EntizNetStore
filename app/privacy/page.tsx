'use client'

import { useBrand } from '@/components/BrandProvider'
import { getBrandClasses } from '@/lib/brand-theme'

export default function PrivacyPage() {
  const { brand, theme } = useBrand()
  const brandClasses = getBrandClasses(brand)
  
  const brandName = brand === 'entiznetstore' ? 'EntizNetStore' : 'PrimeDiscreet'
  const brandColor = brand === 'entiznetstore' ? 'text-amber-600' : 'text-amber-400'

  return (
    <div className={`min-h-screen ${brandClasses.background}`}>
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className={`text-4xl md:text-5xl font-bold mb-4 ${brandColor}`}>
            Privacy Policy
          </h1>
          <p className="text-xl opacity-80 max-w-3xl mx-auto" style={{ color: theme.colors.text.secondary }}>
            Your privacy and security are our top priorities
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Last Updated */}
          <div className={`p-4 rounded-lg ${brandClasses.surface} border-l-4 ${brandColor.replace('text-', 'border-')}`}>
            <p className="text-sm" style={{ color: theme.colors.text.secondary }}>Last updated: December 2024</p>
          </div>

          {/* Introduction */}
          <section>
            <h2 className={`text-2xl font-bold mb-4 ${brandColor}`}>Introduction</h2>
            <p className="mb-4 leading-relaxed" style={{ color: theme.colors.text.primary }}>
              At {brandName}, we understand the sensitive nature of our products and the paramount importance 
              of protecting your privacy. This Privacy Policy explains how we collect, use, protect, and 
              handle your personal information when you use our website and services.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className={`text-2xl font-bold mb-4 ${brandColor}`}>Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.text.primary }}>Personal Information</h3>
                <ul className="list-disc pl-6 space-y-1" style={{ color: theme.colors.text.secondary }}>
                  <li>Name, email address, and contact information</li>
                  <li>Billing and shipping addresses</li>
                  <li>Payment information (processed securely through encrypted channels)</li>
                  <li>Account preferences and communication settings</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.text.primary }}>Automatic Information</h3>
                <ul className="list-disc pl-6 space-y-1" style={{ color: theme.colors.text.secondary }}>
                  <li>Device and browser information</li>
                  <li>IP address and location data</li>
                  <li>Website usage patterns and preferences</li>
                  <li>Cookies and similar tracking technologies</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Your Information */}
          <section>
            <h2 className={`text-2xl font-bold mb-4 ${brandColor}`}>How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2" style={{ color: theme.colors.text.secondary }}>
              <li>Process orders and manage your account</li>
              <li>Provide customer support and respond to inquiries</li>
              <li>Send order confirmations and shipping updates</li>
              <li>Improve our website and personalize your experience</li>
              <li>Comply with legal obligations and prevent fraud</li>
              <li>Send promotional communications (with your consent)</li>
            </ul>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className={`text-2xl font-bold mb-4 ${brandColor}`}>Contact Us</h2>
            <p className="mb-4 leading-relaxed" style={{ color: theme.colors.text.primary }}>
              If you have questions about this Privacy Policy or how we handle your personal information, 
              please contact us:
            </p>
            <div className={`p-6 rounded-lg ${brandClasses.surface}`}>
              <p className="mb-2" style={{ color: theme.colors.text.primary }}><strong>Email:</strong> privacy@{brand}.com</p>
              <p className="mb-2" style={{ color: theme.colors.text.primary }}><strong>Privacy Officer:</strong> Available 24/7 for privacy concerns</p>
              <p style={{ color: theme.colors.text.primary }}><strong>Response Time:</strong> We respond to all privacy inquiries within 24 hours</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}