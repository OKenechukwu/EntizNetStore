'use client'

import { useBrand } from '@/components/BrandProvider'
import { getBrandClasses } from '@/lib/brand-theme'
import Link from 'next/link'

export default function PremiumPage() {
  const { brand, theme } = useBrand()
  const brandClasses = getBrandClasses(brand)
  
  const brandName = brand === 'entiznetstore' ? 'EntizNetStore' : 'PrimeDiscreet'
  const brandColor = brand === 'entiznetstore' ? 'text-amber-600' : 'text-amber-400'
  const buttonClass = brand === 'entiznetstore' 
    ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800' 
    : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600'

  return (
    <div className={`min-h-screen ${brandClasses.background}`}>
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className={`text-4xl md:text-6xl font-bold mb-6 ${brandColor}`}>
            Premium Collection
          </h1>
          <p className="text-xl opacity-80 max-w-3xl mx-auto mb-8" style={{ color: theme.colors.text.secondary }}>
            Discover our exclusive selection of luxury adult wellness products, 
            carefully curated for the most discerning customers
          </p>
          <Link 
            href="/store"
            className={`inline-block px-8 py-4 ${buttonClass} text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105`}
          >
            Shop Premium Collection
          </Link>
        </div>

        {/* Premium Categories */}
        <div className="mb-16">
          <h2 className={`text-3xl font-bold text-center mb-12 ${brandColor}`}>Premium Categories</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link href="/categories?category=masturbators&tier=premium" className={`group p-6 rounded-xl ${brandClasses.surface} hover:scale-105 transition-all duration-300`}>
              <h3 className={`text-xl font-bold mb-3 ${brandColor} group-hover:text-opacity-80`}>Luxury Masturbators</h3>
              <p style={{ color: theme.colors.text.secondary }} className="mb-4">Premium strokers and sleeves with advanced textures and smart features</p>
              <span className={`text-sm ${brandColor} opacity-60`}>Explore Collection →</span>
            </Link>

            <Link href="/categories?category=vibrators&tier=premium" className={`group p-6 rounded-xl ${brandClasses.surface} hover:scale-105 transition-all duration-300`}>
              <h3 className={`text-xl font-bold mb-3 ${brandColor} group-hover:text-opacity-80`}>Designer Vibrators</h3>
              <p style={{ color: theme.colors.text.secondary }} className="mb-4">Artisan-crafted vibrators with luxury finishes and cutting-edge technology</p>
              <span className={`text-sm ${brandColor} opacity-60`}>Explore Collection →</span>
            </Link>

            <Link href="/categories?category=dildos&tier=premium" className={`group p-6 rounded-xl ${brandClasses.surface} hover:scale-105 transition-all duration-300`}>
              <h3 className={`text-xl font-bold mb-3 ${brandColor} group-hover:text-opacity-80`}>Premium Dildos</h3>
              <p style={{ color: theme.colors.text.secondary }} className="mb-4">Hand-finished dildos made from the finest materials</p>
              <span className={`text-sm ${brandColor} opacity-60`}>Explore Collection →</span>
            </Link>

            <Link href="/categories?category=couple-toys&tier=premium" className={`group p-6 rounded-xl ${brandClasses.surface} hover:scale-105 transition-all duration-300`}>
              <h3 className={`text-xl font-bold mb-3 ${brandColor} group-hover:text-opacity-80`}>Couples Luxury</h3>
              <p style={{ color: theme.colors.text.secondary }} className="mb-4">Sophisticated toys designed for intimate couples experiences</p>
              <span className={`text-sm ${brandColor} opacity-60`}>Explore Collection →</span>
            </Link>

            <Link href="/categories?category=anal-toys&tier=premium" className={`group p-6 rounded-xl ${brandClasses.surface} hover:scale-105 transition-all duration-300`}>
              <h3 className={`text-xl font-bold mb-3 ${brandColor} group-hover:text-opacity-80`}>Premium Anal</h3>
              <p style={{ color: theme.colors.text.secondary }} className="mb-4">Luxurious anal toys with superior design and comfort features</p>
              <span className={`text-sm ${brandColor} opacity-60`}>Explore Collection →</span>
            </Link>

            <Link href="/categories?category=sex-dolls&tier=premium" className={`group p-6 rounded-xl ${brandClasses.surface} hover:scale-105 transition-all duration-300`}>
              <h3 className={`text-xl font-bold mb-3 ${brandColor} group-hover:text-opacity-80`}>Luxury Dolls</h3>
              <p style={{ color: theme.colors.text.secondary }} className="mb-4">Ultra-realistic premium dolls with advanced features and customization</p>
              <span className={`text-sm ${brandColor} opacity-60`}>Explore Collection →</span>
            </Link>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center mt-16">
          <Link 
            href="/store"
            className={`inline-block px-12 py-4 ${buttonClass} text-white font-bold text-lg rounded-lg transition-all duration-300 transform hover:scale-105`}
          >
            Explore Premium Collection
          </Link>
          <p className="mt-4" style={{ color: theme.colors.text.secondary }}>Experience luxury like never before</p>
        </div>
      </div>
    </div>
  )
}