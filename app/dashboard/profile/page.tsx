"use client";

import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { updateBuyerProfile, updateSellerProfile } from '@/lib/auth'

interface BuyerProfileForm {
  display_name: string
  first_name: string
  last_name: string
  gender: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | ''
  date_of_birth: string
  country: string
  phone: string
  interests: string[]
}

interface SellerProfileForm {
  storefront_name: string
  bio: string
  business_type: 'individual' | 'business' | 'creator'
  return_policy: string
  shipping_policy: string
  tax_id: string
}

const INTEREST_OPTIONS = [
  'Adult Toys & Accessories', 'Lingerie & Intimates', 'Health & Wellness',
  'Books & Media', 'Fashion & Beauty', 'Home & Lifestyle',
  'Art & Collectibles', 'Technology & Gadgets', 'Jewelry & Accessories'
]

const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Germany', 'France',
  'Australia', 'Japan', 'Netherlands', 'Sweden', 'Switzerland'
]

export default function ProfilePage() {
  const { user, loading, refreshProfile } = useAuth()
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [buyerForm, setBuyerForm] = useState<BuyerProfileForm>({
    display_name: '',
    first_name: '',
    last_name: '',
    gender: '',
    date_of_birth: '',
    country: '',
    phone: '',
    interests: []
  })
  const [sellerForm, setSellerForm] = useState<SellerProfileForm>({
    storefront_name: '',
    bio: '',
    business_type: 'individual',
    return_policy: '',
    shipping_policy: '',
    tax_id: ''
  })

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/sign-in')
      return
    }

    if (user?.profile) {
      if (user.role === 'buyer') {
        const profile = user.profile as any
        setBuyerForm({
          display_name: profile.display_name || '',
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          gender: profile.gender || '',
          date_of_birth: profile.date_of_birth || '',
          country: profile.country || '',
          phone: profile.phone || '',
          interests: profile.interests || []
        })
      } else {
        const profile = user.profile as any
        setSellerForm({
          storefront_name: profile.storefront_name || '',
          bio: profile.bio || '',
          business_type: profile.business_type || 'individual',
          return_policy: profile.return_policy || '',
          shipping_policy: profile.shipping_policy || '',
          tax_id: profile.tax_id || ''
        })
      }
    }
  }, [user, loading, router])

  const handleSaveBuyerProfile = async () => {
    if (!user) return
    
    setIsSaving(true)
    try {
      await updateBuyerProfile(user.id, {
        ...buyerForm,
        updated_at: new Date().toISOString()
      })
      
      await refreshProfile()
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating buyer profile:', error)
      alert('Failed to update profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveSellerProfile = async () => {
    if (!user) return
    
    setIsSaving(true)
    try {
      await updateSellerProfile(user.id, {
        ...sellerForm,
        updated_at: new Date().toISOString()
      })
      
      await refreshProfile()
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating seller profile:', error)
      alert('Failed to update profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleInterest = (interest: string) => {
    setBuyerForm(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }))
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="opacity-80">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="glass-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-accent-gold mb-2">
              {user.role === 'seller' ? 'Store Profile' : 'My Profile'}
            </h1>
            <p className="opacity-80">
              Manage your {user.role} account information and preferences
            </p>
          </div>
          <div className="flex gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="luxury-button-outline px-4 py-2"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={user.role === 'seller' ? handleSaveSellerProfile : handleSaveBuyerProfile}
                  disabled={isSaving}
                  className="luxury-button px-4 py-2 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="luxury-button px-4 py-2"
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Account Information */}
      <div className="glass-card p-6">
        <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">Account Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">Email Address</label>
            <p className="p-3 bg-charcoal/10 rounded-lg opacity-80">{user.email}</p>
            <p className="text-xs opacity-60 mt-1">Email cannot be changed</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Account Type</label>
            <p className="p-3 bg-charcoal/10 rounded-lg opacity-80 capitalize">{user.role}</p>
          </div>
        </div>
      </div>

      {/* Role-specific Profile */}
      {user.role === 'buyer' ? (
        <div className="space-y-6">
          {/* Personal Information */}
          <div className="glass-card p-6">
            <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">Personal Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Display Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={buyerForm.display_name}
                    onChange={(e) => setBuyerForm(prev => ({ ...prev, display_name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
                    placeholder="How others see you"
                  />
                ) : (
                  <p className="p-3 bg-charcoal/10 rounded-lg">{buyerForm.display_name || 'Not set'}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Gender</label>
                {isEditing ? (
                  <select
                    value={buyerForm.gender}
                    onChange={(e) => setBuyerForm(prev => ({ ...prev, gender: e.target.value as any }))}
                    className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                ) : (
                  <p className="p-3 bg-charcoal/10 rounded-lg">{buyerForm.gender || 'Not specified'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">First Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={buyerForm.first_name}
                    onChange={(e) => setBuyerForm(prev => ({ ...prev, first_name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
                  />
                ) : (
                  <p className="p-3 bg-charcoal/10 rounded-lg">{buyerForm.first_name || 'Not set'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Last Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={buyerForm.last_name}
                    onChange={(e) => setBuyerForm(prev => ({ ...prev, last_name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
                  />
                ) : (
                  <p className="p-3 bg-charcoal/10 rounded-lg">{buyerForm.last_name || 'Not set'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Date of Birth</label>
                {isEditing ? (
                  <input
                    type="date"
                    value={buyerForm.date_of_birth}
                    onChange={(e) => setBuyerForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
                  />
                ) : (
                  <p className="p-3 bg-charcoal/10 rounded-lg">
                    {buyerForm.date_of_birth ? new Date(buyerForm.date_of_birth).toLocaleDateString() : 'Not set'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Country</label>
                {isEditing ? (
                  <select
                    value={buyerForm.country}
                    onChange={(e) => setBuyerForm(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
                  >
                    <option value="">Select country</option>
                    {COUNTRIES.map(country => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                ) : (
                  <p className="p-3 bg-charcoal/10 rounded-lg">{buyerForm.country || 'Not set'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Interests */}
          <div className="glass-card p-6">
            <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">Shopping Interests</h2>
            
            {isEditing ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {INTEREST_OPTIONS.map(interest => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`p-3 rounded-lg border text-sm transition-colors ${
                      buyerForm.interests.includes(interest)
                        ? 'border-accent-gold bg-accent-gold/10 text-accent-gold'
                        : 'border-accent-gold/30 hover:border-accent-gold/50'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {buyerForm.interests.length > 0 ? (
                  buyerForm.interests.map(interest => (
                    <span
                      key={interest}
                      className="px-3 py-1 bg-accent-gold/20 text-accent-gold rounded-full text-sm"
                    >
                      {interest}
                    </span>
                  ))
                ) : (
                  <p className="opacity-60">No interests selected</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Store Information */}
          <div className="glass-card p-6">
            <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">Store Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Store Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={sellerForm.storefront_name}
                    onChange={(e) => setSellerForm(prev => ({ ...prev, storefront_name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
                  />
                ) : (
                  <p className="p-3 bg-charcoal/10 rounded-lg">{sellerForm.storefront_name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Business Type</label>
                {isEditing ? (
                  <select
                    value={sellerForm.business_type}
                    onChange={(e) => setSellerForm(prev => ({ ...prev, business_type: e.target.value as any }))}
                    className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
                  >
                    <option value="individual">Individual</option>
                    <option value="business">Business</option>
                    <option value="creator">Creator</option>
                  </select>
                ) : (
                  <p className="p-3 bg-charcoal/10 rounded-lg capitalize">{sellerForm.business_type}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Store Description</label>
                {isEditing ? (
                  <textarea
                    value={sellerForm.bio}
                    onChange={(e) => setSellerForm(prev => ({ ...prev, bio: e.target.value }))}
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
                    placeholder="Tell customers about your store..."
                  />
                ) : (
                  <p className="p-3 bg-charcoal/10 rounded-lg min-h-[100px]">{sellerForm.bio || 'No description'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Business Policies */}
          <div className="glass-card p-6">
            <h2 className="font-serif text-xl font-bold text-accent-gold mb-4">Business Policies</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Return Policy</label>
                {isEditing ? (
                  <textarea
                    value={sellerForm.return_policy}
                    onChange={(e) => setSellerForm(prev => ({ ...prev, return_policy: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
                    placeholder="Describe your return and refund policy..."
                  />
                ) : (
                  <p className="p-3 bg-charcoal/10 rounded-lg min-h-[80px]">{sellerForm.return_policy || 'No return policy set'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Shipping Policy</label>
                {isEditing ? (
                  <textarea
                    value={sellerForm.shipping_policy}
                    onChange={(e) => setSellerForm(prev => ({ ...prev, shipping_policy: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
                    placeholder="Describe your shipping methods and timelines..."
                  />
                ) : (
                  <p className="p-3 bg-charcoal/10 rounded-lg min-h-[80px]">{sellerForm.shipping_policy || 'No shipping policy set'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tax ID (Optional)</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={sellerForm.tax_id}
                    onChange={(e) => setSellerForm(prev => ({ ...prev, tax_id: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
                    placeholder="Business tax identification number"
                  />
                ) : (
                  <p className="p-3 bg-charcoal/10 rounded-lg">{sellerForm.tax_id || 'Not provided'}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}