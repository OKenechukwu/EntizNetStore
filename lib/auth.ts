// lib/auth.ts
import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'

export type UserRole = 'buyer' | 'seller' | 'admin'

export type AuthUser = {
  id: string
  email: string
  role: UserRole
  profile?: BuyerProfile | SellerProfile
}

export type BuyerProfile = {
  id: string
  display_name?: string
  first_name?: string
  last_name?: string
  gender?: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say'
  date_of_birth?: string
  country?: string
  phone?: string
  communication_preferences: any
  interests: string[]
  created_at: string
  updated_at: string
}

export type SellerProfile = {
  id: string
  storefront_name: string
  bio?: string
  logo_url?: string
  banner_url?: string
  business_type: 'individual' | 'business' | 'creator'
  tax_id?: string
  verification_status: 'pending' | 'verified' | 'rejected'
  verification_documents?: any
  payout_method?: any
  return_policy?: string
  shipping_policy?: string
  created_at: string
  updated_at: string
}

// Authentication functions
export async function signUp(email: string, password: string, role: UserRole = 'buyer') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role
      }
    }
  })

  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// Profile functions
export async function createBuyerProfile(userId: string, profile: Partial<BuyerProfile>) {
  const { data, error } = await supabase
    .from('profiles_buyer')
    .insert({
      id: userId,
      ...profile
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function createSellerProfile(userId: string, profile: Partial<SellerProfile>) {
  const { data, error } = await supabase
    .from('profiles_seller')
    .insert({
      id: userId,
      ...profile,
      verification_status: 'pending'
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getBuyerProfile(userId: string): Promise<BuyerProfile | null> {
  const { data, error } = await supabase
    .from('profiles_buyer')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) return null
  return data
}

export async function getSellerProfile(userId: string): Promise<SellerProfile | null> {
  const { data, error } = await supabase
    .from('profiles_seller')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) return null
  return data
}

export async function updateBuyerProfile(userId: string, updates: Partial<BuyerProfile>) {
  const { data, error } = await supabase
    .from('profiles_buyer')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateSellerProfile(userId: string, updates: Partial<SellerProfile>) {
  const { data, error } = await supabase
    .from('profiles_seller')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

// KYC and verification
export async function submitKYCDocuments(userId: string, documents: {
  documentType: 'identity' | 'business' | 'address'
  fileUrl: string
  metadata?: any
}) {
  const { data, error } = await supabase
    .from('profiles_seller')
    .update({
      verification_documents: documents,
      verification_status: 'pending'
    })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getUserRole(userId: string): Promise<UserRole> {
  // Check if user has seller profile
  const sellerProfile = await getSellerProfile(userId)
  if (sellerProfile) return 'seller'

  // Check if user has buyer profile
  const buyerProfile = await getBuyerProfile(userId)
  if (buyerProfile) return 'buyer'

  // Default to buyer
  return 'buyer'
}