'use client'

import { useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { useRouter } from 'next/navigation'

export default function EntizNetStorePage() {
  const { setBrand } = useBrand()
  const router = useRouter()

  useEffect(() => {
    // Set brand to EntizNetStore when accessing this route
    setBrand('entiznetstore')
  }, [setBrand])

  useEffect(() => {
    // Redirect to main store with brand context
    router.push('/store')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-gold mx-auto mb-4"></div>
        <p className="text-charcoal/60">Loading EntizNet Store...</p>
      </div>
    </div>
  )
}