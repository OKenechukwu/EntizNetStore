'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useBrand } from '@/components/BrandProvider'

interface HeroSlide {
  id: string
  type: 'image' | 'video'
  src: string
  poster?: string // For video poster
  alt: string
  title: string
  subtitle: string
  cta1: {
    text: string
    href: string
    primary?: boolean
  }
  cta2?: {
    text: string
    href: string
    primary?: boolean
  }
}

interface HeroSliderProps {
  slides?: HeroSlide[]
  autoplayInterval?: number
  className?: string
}

const defaultSlides: HeroSlide[] = [
  {
    id: '1',
    type: 'image',
    src: '/images/hero/luxury-collection.jpg',
    alt: 'Luxury Adult Wellness Collection',
    title: 'Luxury Adult Wellness',
    subtitle: 'Discover premium intimate products designed for your pleasure and wellbeing',
    cta1: {
      text: 'Explore Collection',
      href: '/collections/premium',
      primary: true
    },
    cta2: {
      text: 'Browse Categories',
      href: '/categories'
    }
  },
  {
    id: '2',
    type: 'video',
    src: '/videos/hero/wellness-experience.mp4',
    poster: '/images/hero/wellness-poster.jpg',
    alt: 'Premium Wellness Experience',
    title: 'Elevate Your Intimacy',
    subtitle: 'Experience the finest in adult wellness with our curated collection of premium products',
    cta1: {
      text: 'Shop Premium',
      href: '/premium',
      primary: true
    },
    cta2: {
      text: 'Learn More',
      href: '/about'
    }
  },
  {
    id: '3',
    type: 'image',
    src: '/images/hero/discreet-luxury.jpg',
    alt: 'Discreet Luxury Shopping',
    title: 'Discreet & Luxurious',
    subtitle: 'Private shopping experience with premium packaging and discreet delivery worldwide',
    cta1: {
      text: 'Start Shopping',
      href: '/store',
      primary: true
    },
    cta2: {
      text: 'Privacy Policy',
      href: '/privacy'
    }
  }
]

export default function HeroSlider({
  slides = defaultSlides,
  autoplayInterval = 18000, // 18 seconds
  className = ""
}: HeroSliderProps) {
  const { brand, theme } = useBrand()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-advance slides
  useEffect(() => {
    if (!isPlaying || isPaused) return

    intervalRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, autoplayInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPlaying, isPaused, autoplayInterval, slides.length])

  // Handle video play/pause
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const currentSlideData = slides[currentSlide]
    if (currentSlideData.type === 'video') {
      if (isPlaying && !isPaused) {
        video.play().catch(console.error)
      } else {
        video.pause()
      }
    }
  }, [currentSlide, isPlaying, isPaused, slides])

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
  }

  const handleMouseEnter = () => {
    setIsPaused(true)
  }

  const handleMouseLeave = () => {
    setIsPaused(false)
  }

  const handleVideoEnd = () => {
    // Move to next slide when video ends
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }

  const currentSlideData = slides[currentSlide]

  return (
    <div 
      className={`relative w-full h-[70vh] min-h-[500px] overflow-hidden rounded-2xl ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Slides */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlideData.id}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {currentSlideData.type === 'video' ? (
            <video
              ref={videoRef}
              src={currentSlideData.src}
              poster={currentSlideData.poster}
              className="w-full h-full object-cover"
              muted
              loop={false}
              playsInline
              onEnded={handleVideoEnd}
              aria-label={currentSlideData.alt}
            />
          ) : (
            <img
              src={currentSlideData.src}
              alt={currentSlideData.alt}
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Content Overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center text-white px-6 max-w-4xl mx-auto">
          <motion.h1
            key={`title-${currentSlideData.id}`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold mb-6"
            style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
          >
            {currentSlideData.title}
          </motion.h1>
          
          <motion.p
            key={`subtitle-${currentSlideData.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-lg md:text-xl lg:text-2xl mb-8 text-white/90 leading-relaxed max-w-3xl mx-auto"
            style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
          >
            {currentSlideData.subtitle}
          </motion.p>
          
          <motion.div
            key={`ctas-${currentSlideData.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link
              href={currentSlideData.cta1.href}
              className={`px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                currentSlideData.cta1.primary
                  ? 'bg-brandPink text-white hover:bg-brandPink-600'
                  : 'bg-white/20 text-white border border-white/30 hover:bg-white/30 backdrop-blur-sm'
              }`}
            >
              {currentSlideData.cta1.text}
            </Link>
            
            {currentSlideData.cta2 && (
              <Link
                href={currentSlideData.cta2.href}
                className={`px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                  currentSlideData.cta2.primary
                    ? 'bg-brandPink text-white hover:bg-brandPink-600'
                    : 'bg-white/20 text-white border border-white/30 hover:bg-white/30 backdrop-blur-sm'
                }`}
              >
                {currentSlideData.cta2.text}
              </Link>
            )}
          </motion.div>
        </div>
      </div>

      {/* Category Pills */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
      >
        <div className="flex flex-wrap gap-3 justify-center">
          {['Wellness', 'Massage', 'Luxury', 'Premium', 'Discreet'].map((category) => (
            <Link
              key={category}
              href={`/categories/${category.toLowerCase()}`}
              className="px-4 py-2 bg-brandPink hover:bg-brandPink-600 text-white rounded-full text-sm font-medium transition-all duration-300 hover:scale-105"
            >
              {category}
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Navigation Dots */}
      <div className="absolute bottom-4 right-6">
        <div className="flex gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? 'bg-white shadow-lg scale-110'
                  : 'bg-white/50 hover:bg-white/70'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Play/Pause Button */}
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className="absolute top-4 right-4 w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-all duration-300"
        aria-label={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
      >
        {isPlaying ? (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
          </svg>
        ) : (
          <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>

      {/* Loading indicator for videos */}
      {currentSlideData.type === 'video' && (
        <div className="absolute top-4 left-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm text-white text-sm">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span>LIVE</span>
          </div>
        </div>
      )}
    </div>
  )
}