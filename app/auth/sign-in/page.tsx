"use client";

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from '@/lib/auth'
import { useAuth } from '@/components/AuthProvider'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { refreshProfile } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await signIn(email, password)
      await refreshProfile()
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="glass-card p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-bold text-accent-gold mb-2">
            Welcome Back
          </h1>
          <p className="opacity-80">
            Sign in to your EntizNet account
          </p>
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
              placeholder="Your password"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-600/20 border border-red-600/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="luxury-button w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-4">
          <Link 
            href="/auth/forgot-password"
            className="text-sm text-accent-gold hover:opacity-80 transition-opacity"
          >
            Forgot your password?
          </Link>
          
          <div className="border-t border-accent-gold/20 pt-4">
            <p className="text-sm opacity-80 mb-3">
              Don't have an account?
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link 
                href="/auth/sign-up?role=buyer"
                className="luxury-button-outline flex-1 text-center py-2"
              >
                Join as Buyer
              </Link>
              <Link 
                href="/auth/sign-up?role=seller"
                className="luxury-button-outline flex-1 text-center py-2"
              >
                Become a Seller
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}