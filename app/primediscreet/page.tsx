'use client'

import { useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { useRouter } from 'next/navigation'

export default function PrimeDiscreetPage() {
  const { setBrand } = useBrand()
  const router = useRouter()

  useEffect(() => {
    // Set brand to PrimeDiscreet when accessing this route
    setBrand('primediscreet')
  }, [setBrand])

  useEffect(() => {
    // Redirect to main store with brand context
    router.push('/store')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 to-black">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-300 mx-auto mb-4"></div>
        <p className="text-zinc-300">Loading Prime Discreet...</p>
      </div>
    </div>
  )
}