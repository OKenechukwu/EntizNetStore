'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useBrand } from '@/components/BrandProvider'

interface WishlistItem {
  id: string
  product_id: string
  variant_id?: string
  product?: {
    id: string
    title: string
    slug: string
    base_price: number
    compare_at_price?: number
    image_url?: string
    seller?: {
      storefront_name: string
    }
  }
  created_at: string
}

interface WishlistContextType {
  wishlistItems: WishlistItem[]
  isLoading: boolean
  isInWishlist: (productId: string, variantId?: string) => boolean
  addToWishlist: (productId: string, variantId?: string) => Promise<boolean>
  removeFromWishlist: (productId: string, variantId?: string) => Promise<boolean>
  toggleWishlist: (productId: string, variantId?: string) => Promise<boolean>
  clearWishlist: () => Promise<void>
  refreshWishlist: () => Promise<void>
  wishlistCount: number
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined)

export function useWishlist() {
  const context = useContext(WishlistContext)
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider')
  }
  return context
}

interface WishlistProviderProps {
  children: ReactNode
}

export default function WishlistProvider({ children }: WishlistProviderProps) {
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const { brand } = useBrand()
  const supabase = getSupabaseClient()

  useEffect(() => {
    // Get initial user and load wishlist
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        await loadWishlist(user.id)
      } else {
        // Load from localStorage for guest users
        loadGuestWishlist()
      }
      setIsLoading(false)
    }

    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user || null
        setUser(currentUser)
        
        if (currentUser) {
          // User logged in, migrate guest wishlist
          await migrateGuestWishlist(currentUser.id)
          await loadWishlist(currentUser.id)
        } else {
          // User logged out, clear wishlist
          setWishlistItems([])
          loadGuestWishlist()
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const loadWishlist = async (userId: string) => {
    try {
      const response = await fetch('/api/wishlist', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setWishlistItems(data.items || [])
      }
    } catch (error) {
      console.error('Error loading wishlist:', error)
      setWishlistItems([])
    }
  }

  const loadGuestWishlist = () => {
    try {
      const guestWishlist = localStorage.getItem(`guest_wishlist_${brand}`)
      if (guestWishlist) {
        const items = JSON.parse(guestWishlist)
        setWishlistItems(items.map((item: any) => ({
          id: `guest_${item.product_id}_${item.variant_id || ''}`,
          product_id: item.product_id,
          variant_id: item.variant_id,
          created_at: item.created_at || new Date().toISOString()
        })))
      } else {
        setWishlistItems([])
      }
    } catch (error) {
      console.error('Error loading guest wishlist:', error)
      setWishlistItems([])
    }
  }

  const saveGuestWishlist = (items: WishlistItem[]) => {
    try {
      const guestItems = items.map(item => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        created_at: item.created_at
      }))
      localStorage.setItem(`guest_wishlist_${brand}`, JSON.stringify(guestItems))
    } catch (error) {
      console.error('Error saving guest wishlist:', error)
    }
  }

  const migrateGuestWishlist = async (userId: string) => {
    try {
      const guestWishlist = localStorage.getItem(`guest_wishlist_${brand}`)
      if (guestWishlist) {
        const guestItems = JSON.parse(guestWishlist)
        
        // Add guest items to user's wishlist
        for (const item of guestItems) {
          await addToWishlist(item.product_id, item.variant_id)
        }
        
        // Clear guest wishlist
        localStorage.removeItem(`guest_wishlist_${brand}`)
      }
    } catch (error) {
      console.error('Error migrating guest wishlist:', error)
    }
  }

  const isInWishlist = (productId: string, variantId?: string): boolean => {
    return wishlistItems.some(item => 
      item.product_id === productId && 
      (variantId ? item.variant_id === variantId : !item.variant_id)
    )
  }

  const addToWishlist = async (productId: string, variantId?: string): Promise<boolean> => {
    try {
      if (user) {
        // Authenticated user - save to database
        const response = await fetch('/api/wishlist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            product_id: productId,
            variant_id: variantId
          })
        })

        if (response.ok) {
          const data = await response.json()
          setWishlistItems(prev => [...prev, data.item])
          return true
        }
      } else {
        // Guest user - save to localStorage
        const newItem: WishlistItem = {
          id: `guest_${productId}_${variantId || ''}`,
          product_id: productId,
          variant_id: variantId,
          created_at: new Date().toISOString()
        }
        
        const updatedItems = [...wishlistItems, newItem]
        setWishlistItems(updatedItems)
        saveGuestWishlist(updatedItems)
        return true
      }
    } catch (error) {
      console.error('Error adding to wishlist:', error)
    }
    return false
  }

  const removeFromWishlist = async (productId: string, variantId?: string): Promise<boolean> => {
    try {
      if (user) {
        // Authenticated user - remove from database
        const response = await fetch('/api/wishlist', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            product_id: productId,
            variant_id: variantId
          })
        })

        if (response.ok) {
          setWishlistItems(prev => prev.filter(item => 
            !(item.product_id === productId && 
              (variantId ? item.variant_id === variantId : !item.variant_id))
          ))
          return true
        }
      } else {
        // Guest user - remove from localStorage
        const updatedItems = wishlistItems.filter(item => 
          !(item.product_id === productId && 
            (variantId ? item.variant_id === variantId : !item.variant_id))
        )
        setWishlistItems(updatedItems)
        saveGuestWishlist(updatedItems)
        return true
      }
    } catch (error) {
      console.error('Error removing from wishlist:', error)
    }
    return false
  }

  const toggleWishlist = async (productId: string, variantId?: string): Promise<boolean> => {
    const inWishlist = isInWishlist(productId, variantId)
    if (inWishlist) {
      return await removeFromWishlist(productId, variantId)
    } else {
      return await addToWishlist(productId, variantId)
    }
  }

  const clearWishlist = async (): Promise<void> => {
    try {
      if (user) {
        // Clear user's wishlist in database
        const response = await fetch('/api/wishlist/clear', {
          method: 'DELETE'
        })

        if (response.ok) {
          setWishlistItems([])
        }
      } else {
        // Clear guest wishlist
        setWishlistItems([])
        localStorage.removeItem(`guest_wishlist_${brand}`)
      }
    } catch (error) {
      console.error('Error clearing wishlist:', error)
    }
  }

  const refreshWishlist = async (): Promise<void> => {
    if (user) {
      await loadWishlist(user.id)
    } else {
      loadGuestWishlist()
    }
  }

  const value: WishlistContextType = {
    wishlistItems,
    isLoading,
    isInWishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    clearWishlist,
    refreshWishlist,
    wishlistCount: wishlistItems.length
  }

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  )
}