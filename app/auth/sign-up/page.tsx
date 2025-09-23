"use client";

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signUp, createBuyerProfile, createSellerProfile, type UserRole } from '@/lib/auth'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<UserRole>('buyer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const roleParam = searchParams.get('role') as UserRole
    if (roleParam === 'seller' || roleParam === 'buyer') {
      setRole(roleParam)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      const { user } = await signUp(email, password, role)
      
      if (user) {
        // Create initial profile based on role
        if (role === 'buyer') {
          await createBuyerProfile(user.id, {
            display_name: email.split('@')[0],
            communication_preferences: {},
            interests: []
          })
        } else {
          await createSellerProfile(user.id, {
            storefront_name: `${email.split('@')[0]}'s Store`,
            business_type: 'individual'
          })
        }
        
        setSuccess(true)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign up')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="glass-card p-8 w-full max-w-md text-center">
          <div className="text-accent-gold mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="font-serif text-2xl font-bold text-accent-gold mb-4">
            Account Created!
          </h1>
          <p className="opacity-80 mb-6">
            Please check your email to verify your account before signing in.
          </p>
          <Link 
            href="/auth/sign-in"
            className="luxury-button px-6 py-3"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="glass-card p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold text-accent-gold mb-2">
            Join EntizNet
          </h1>
          <p className="opacity-80">
            Create your {role === 'seller' ? 'seller' : 'buyer'} account
          </p>
        </div>

        {/* Role Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-3">Account Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole('buyer')}
              className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                role === 'buyer'
                  ? 'border-accent-gold bg-accent-gold/10 text-accent-gold'
                  : 'border-accent-gold/30 hover:border-accent-gold/50'
              }`}
            >
              <div className="font-semibold">Buyer</div>
              <div className="text-xs opacity-70">Shop premium products</div>
            </button>
            <button
              type="button"
              onClick={() => setRole('seller')}
              className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                role === 'seller'
                  ? 'border-accent-gold bg-accent-gold/10 text-accent-gold'
                  : 'border-accent-gold/30 hover:border-accent-gold/50'
              }`}
            >
              <div className="font-semibold">Seller</div>
              <div className="text-xs opacity-70">Create your store</div>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none transition-colors"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none transition-colors"
              placeholder="Choose a secure password"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium mb-2">
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none transition-colors"
              placeholder="Confirm your password"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-600/20 border border-red-600/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="text-xs opacity-70 p-3 bg-accent-gold/10 rounded-lg">
            By creating an account, you confirm you are 18+ and agree to our Terms of Service and Privacy Policy. 
            All content is for adults only.
          </div>

          <button
            type="submit"
            disabled={loading}
            className="luxury-button w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account...' : `Create ${role === 'seller' ? 'Seller' : 'Buyer'} Account`}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm opacity-80 mb-3">
            Already have an account?
          </p>
          <Link 
            href="/auth/sign-in"
            className="luxury-button-outline px-6 py-2"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}