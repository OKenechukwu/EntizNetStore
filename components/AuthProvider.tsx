"use client";

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCurrentUser, getBuyerProfile, getSellerProfile, type AuthUser, type UserRole } from '@/lib/auth'
import type { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = async () => {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        setUser(null)
        return
      }

      // Try to get seller profile first, then buyer profile
      const sellerProfile = await getSellerProfile(currentUser.id)
      const buyerProfile = !sellerProfile ? await getBuyerProfile(currentUser.id) : null

      const role: UserRole = sellerProfile ? 'seller' : 'buyer'
      const profile = sellerProfile || buyerProfile

      setUser({
        id: currentUser.id,
        email: currentUser.email!,
        role,
        profile
      })
    } catch (error) {
      console.error('Error refreshing profile:', error)
      setUser(null)
    }
  }

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      setLoading(true)
      try {
        await refreshProfile()
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null)
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await refreshProfile()
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const value = {
    user,
    loading,
    signOut: handleSignOut,
    refreshProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}