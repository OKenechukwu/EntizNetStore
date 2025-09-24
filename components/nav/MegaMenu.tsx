'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useBrand } from '@/components/BrandProvider'

interface MenuSection {
  name: string
  image: string
  description: string
  link: string
}

interface MegaMenuProps {
  trigger: React.ReactNode
  sections: MenuSection[]
  title: string
  className?: string
  isOpen?: boolean
  onToggle?: () => void
}

export default function MegaMenu({
  trigger,
  sections,
  title,
  className = "",
  isOpen = false,
  onToggle
}: MegaMenuProps) {
  const { theme } = useBrand()
  const [isHovered, setIsHovered] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => {
      window.removeEventListener('resize', checkMobile)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Handle click outside to close menu on mobile
  useEffect(() => {
    if (!isMobile) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        if (onToggle && isOpen) {
          onToggle()
        }
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, isMobile, onToggle])

  const handleMouseEnter = () => {
    if (isMobile) return
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    if (isMobile) return
    
    timeoutRef.current = setTimeout(() => {
      setIsHovered(false)
    }, 150) // Small delay to prevent flickering
  }

  const handleClick = () => {
    if (isMobile && onToggle) {
      onToggle()
    }
  }

  const isMenuOpen = isMobile ? isOpen : isHovered

  return (
    <div 
      ref={menuRef}
      className={`relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger */}
      <div onClick={handleClick} className="cursor-pointer">
        {trigger}
      </div>

      {/* Mega Menu Dropdown */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-screen max-w-4xl z-50 ${
              isMobile ? 'fixed left-4 right-4 w-auto max-w-none transform-none' : ''
            }`}
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.glass.border
            }}
          >
            <div className="rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-sm"
                 style={{
                   backgroundColor: theme.colors.surface,
                   borderColor: theme.colors.glass.border,
                   boxShadow: theme.colors.shadow.luxury
                 }}>
              
              {/* Header */}
              <div className="px-6 py-4 border-b"
                   style={{ borderColor: theme.colors.glass.border }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-serif font-bold"
                      style={{ color: theme.colors.text.primary }}>
                    {title}
                  </h3>
                  
                  {isMobile && (
                    <button
                      onClick={onToggle}
                      className="p-2 rounded-full hover:bg-white/10 transition-colors"
                      aria-label="Close menu"
                    >
                      <svg className="w-6 h-6" style={{ color: theme.colors.text.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Content Grid */}
              <div className="p-6">
                <div className={`grid gap-6 ${
                  sections.length <= 4 ? `grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(4, sections.length)}` : 
                  'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                }`}>
                  {sections.map((section, index) => (
                    <motion.div
                      key={section.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                    >
                      <Link
                        href={section.link}
                        className="group block p-4 rounded-xl transition-all duration-300 hover:scale-105"
                        style={{
                          backgroundColor: `${theme.colors.glass.bg}50`,
                          borderColor: theme.colors.glass.border
                        }}
                        onMouseEnter={() => {
                          // Keep menu open when hovering over items
                          if (timeoutRef.current) {
                            clearTimeout(timeoutRef.current)
                          }
                        }}
                      >
                        {/* Image */}
                        <div className="relative aspect-video rounded-lg overflow-hidden mb-3">
                          <img
                            src={section.image}
                            alt={section.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                            onError={(e) => {
                              // Fallback for missing images
                              (e.target as HTMLImageElement).src = '/images/placeholder.jpg'
                            }}
                          />
                          
                          {/* Overlay on hover */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="absolute bottom-2 right-2">
                              <div className="w-8 h-8 rounded-full bg-brandPink flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Content */}
                        <div>
                          <h4 className="font-semibold text-lg mb-2 group-hover:text-brandPink transition-colors duration-300"
                              style={{ color: theme.colors.text.primary }}>
                            {section.name}
                          </h4>
                          <p className="text-sm leading-relaxed line-clamp-2"
                             style={{ color: theme.colors.text.secondary }}>
                            {section.description}
                          </p>
                        </div>
                        
                        {/* Hover indicator */}
                        <div className="mt-3 flex items-center text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0"
                             style={{ color: theme.colors.accent }}>
                          <span>Explore</span>
                          <svg className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
                
                {/* View All Link */}
                <div className="mt-8 text-center">
                  <Link
                    href="/categories"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-brandPink hover:bg-brandPink-600 text-white font-semibold rounded-full transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <span>View All Categories</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Mobile-friendly hamburger menu component
export function MobileMenuToggle({ 
  isOpen, 
  onToggle, 
  className = "" 
}: { 
  isOpen: boolean
  onToggle: () => void
  className?: string 
}) {
  const { theme } = useBrand()
  
  return (
    <button
      onClick={onToggle}
      className={`relative w-10 h-10 flex flex-col items-center justify-center space-y-1 transition-all duration-300 ${className}`}
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={isOpen}
    >
      <motion.span
        animate={{
          rotate: isOpen ? 45 : 0,
          y: isOpen ? 8 : 0
        }}
        className="w-6 h-0.5 rounded-full transition-all duration-300"
        style={{ backgroundColor: theme.colors.text.primary }}
      />
      <motion.span
        animate={{
          opacity: isOpen ? 0 : 1
        }}
        className="w-6 h-0.5 rounded-full transition-all duration-300"
        style={{ backgroundColor: theme.colors.text.primary }}
      />
      <motion.span
        animate={{
          rotate: isOpen ? -45 : 0,
          y: isOpen ? -8 : 0
        }}
        className="w-6 h-0.5 rounded-full transition-all duration-300"
        style={{ backgroundColor: theme.colors.text.primary }}
      />
    </button>
  )
}