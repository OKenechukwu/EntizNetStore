'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useBrand } from '@/components/BrandProvider'

interface SideVideoAdProps {
  src: string
  type: 'video' | 'image'
  poster?: string
  title: string
  caption?: string
  ctaLabel: string
  href: string
  autoplay?: boolean
  duration?: number
  className?: string
}

export default function SideVideoAd({
  src,
  type,
  poster,
  title,
  caption,
  ctaLabel,
  href,
  autoplay = true,
  duration = 15,
  className = ""
}: SideVideoAdProps) {
  const { theme } = useBrand()
  const [isLoaded, setIsLoaded] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || type !== 'video') return

    const handleLoadedData = () => {
      setIsLoaded(true)
      if (autoplay) {
        video.play().catch(() => setError(true))
      }
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleError = () => setError(true)

    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('error', handleError)

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('error', handleError)
    }
  }, [autoplay, type])

  const handleCardClick = () => {
    // Navigate to the href when the entire card is clicked
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const handleVideoToggle = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play().catch(() => setError(true))
    }
  }

  return (
    <div className={`w-full max-w-sm mx-auto ${className}`}>
      <div
        className="group relative overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105"
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border
        }}
        onClick={handleCardClick}
      >
        {/* Media Container */}
        <div className="relative aspect-[4/5] overflow-hidden">
          {type === 'video' ? (
            <>
              <video
                ref={videoRef}
                src={src}
                poster={poster}
                className="w-full h-full object-cover"
                muted
                loop
                playsInline
                preload="metadata"
              />
              
              {/* Video Controls Overlay */}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={handleVideoToggle}
                    className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-all duration-300"
                    aria-label={isPlaying ? 'Pause video' : 'Play video'}
                  >
                    {isPlaying ? (
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                      </svg>
                    ) : (
                      <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Duration Badge */}
              {duration && (
                <div className="absolute top-3 left-3">
                  <span className="px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-white text-xs font-medium">
                    {duration}s
                  </span>
                </div>
              )}

              {/* Live Indicator */}
              {isPlaying && (
                <div className="absolute top-3 right-3">
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-red-600 text-white text-xs font-medium">
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                    LIVE
                  </div>
                </div>
              )}
            </>
          ) : (
            <img
              src={src}
              alt={title}
              className="w-full h-full object-cover"
              onLoad={() => setIsLoaded(true)}
              onError={() => setError(true)}
            />
          )}

          {/* Loading State */}
          {!isLoaded && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-200 animate-pulse">
              <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin"
                   style={{ color: theme.colors.accent }}></div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center p-4">
                <div className="text-4xl mb-2">📺</div>
                <p className="text-sm text-gray-600">Media unavailable</p>
              </div>
            </div>
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
        </div>

        {/* Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <h3 className="text-xl font-bold mb-2 group-hover:text-brandPink transition-colors duration-300"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
            {title}
          </h3>
          
          {caption && (
            <p className="text-sm text-white/90 mb-4 line-clamp-2 leading-relaxed"
               style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
              {caption}
            </p>
          )}
          
          {/* CTA Button */}
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brandPink hover:bg-brandPink-600 text-white rounded-lg font-semibold text-sm transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            {ctaLabel}
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Corner Accent */}
        <div className="absolute top-0 right-0 w-0 h-0 border-l-[40px] border-l-transparent border-t-[40px] border-t-brandPink opacity-80">
        </div>
      </div>

      {/* Ad Label */}
      <div className="flex items-center justify-center mt-2">
        <span className="px-3 py-1 rounded-full text-xs font-medium border bg-brandPink/20 border-brandPink text-brandPink">
          Sponsored
        </span>
      </div>
    </div>
  )
}