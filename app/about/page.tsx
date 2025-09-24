'use client'

import { useBrand } from '@/components/BrandProvider'
import { getBrandClasses } from '@/lib/brand-theme'

export default function AboutPage() {
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
            About {brandName}
          </h1>
          <p className="text-xl opacity-80 max-w-3xl mx-auto">
            Your premium destination for luxury adult wellness products
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Our Story */}
          <section>
            <h2 className={`text-3xl font-bold mb-6 ${brandColor}`}>Our Story</h2>
            <div className="prose prose-lg max-w-none">
              <p className="mb-6 leading-relaxed" style={{ color: theme.colors.text.primary }}>
                {brandName} was founded with a simple yet powerful vision: to create a sophisticated, 
                discreet, and luxurious shopping experience for adult wellness products. We believe 
                that intimate wellness is an essential part of self-care and personal happiness.
              </p>
              <p className="mb-6 leading-relaxed" style={{ color: theme.colors.text.primary }}>
                Our carefully curated collection features only the finest products from trusted brands, 
                ensuring quality, safety, and satisfaction in every purchase. We understand the importance 
                of privacy and discretion, which is why we've built our platform with the utmost respect 
                for your personal journey.
              </p>
            </div>
          </section>

          {/* Our Values */}
          <section>
            <h2 className={`text-3xl font-bold mb-6 ${brandColor}`}>Our Values</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className={`p-6 rounded-lg ${brandClasses.surface}`}>
                <h3 className={`text-xl font-semibold mb-4 ${brandColor}`}>Quality & Safety</h3>
                <p style={{ color: theme.colors.text.secondary }}>Every product is carefully selected and tested to meet our rigorous standards for quality and safety.</p>
              </div>
              <div className={`p-6 rounded-lg ${brandClasses.surface}`}>
                <h3 className={`text-xl font-semibold mb-4 ${brandColor}`}>Privacy & Discretion</h3>
                <p style={{ color: theme.colors.text.secondary }}>Your privacy is paramount. All orders are packaged discreetly with no identifying marks or branding.</p>
              </div>
              <div className={`p-6 rounded-lg ${brandClasses.surface}`}>
                <h3 className={`text-xl font-semibold mb-4 ${brandColor}`}>Customer Care</h3>
                <p style={{ color: theme.colors.text.secondary }}>Our dedicated support team is here to help with questions, concerns, and product recommendations.</p>
              </div>
              <div className={`p-6 rounded-lg ${brandClasses.surface}`}>
                <h3 className={`text-xl font-semibold mb-4 ${brandColor}`}>Innovation</h3>
                <p style={{ color: theme.colors.text.secondary }}>We constantly seek the latest innovations in adult wellness to bring you cutting-edge products.</p>
              </div>
            </div>
          </section>

          {/* Why Choose Us */}
          <section>
            <h2 className={`text-3xl font-bold mb-6 ${brandColor}`}>Why Choose {brandName}?</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className={`w-2 h-2 rounded-full ${brandColor.replace('text-', 'bg-')} mt-3 flex-shrink-0`}></div>
                <div>
                  <h4 className="font-semibold mb-2" style={{ color: theme.colors.text.primary }}>Curated Premium Selection</h4>
                  <p style={{ color: theme.colors.text.secondary }}>Hand-picked products from the world's most respected adult wellness brands.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className={`w-2 h-2 rounded-full ${brandColor.replace('text-', 'bg-')} mt-3 flex-shrink-0`}></div>
                <div>
                  <h4 className="font-semibold mb-2" style={{ color: theme.colors.text.primary }}>Discreet Worldwide Shipping</h4>
                  <p style={{ color: theme.colors.text.secondary }}>Fast, secure, and completely private delivery to your door.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className={`w-2 h-2 rounded-full ${brandColor.replace('text-', 'bg-')} mt-3 flex-shrink-0`}></div>
                <div>
                  <h4 className="font-semibold mb-2" style={{ color: theme.colors.text.primary }}>Expert Customer Support</h4>
                  <p style={{ color: theme.colors.text.secondary }}>Knowledgeable team ready to assist with product selection and care.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className={`w-2 h-2 rounded-full ${brandColor.replace('text-', 'bg-')} mt-3 flex-shrink-0`}></div>
                <div>
                  <h4 className="font-semibold mb-2" style={{ color: theme.colors.text.primary }}>Secure Shopping Experience</h4>
                  <p style={{ color: theme.colors.text.secondary }}>SSL encryption and secure payment processing for your peace of mind.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}