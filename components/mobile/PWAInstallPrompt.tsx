'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { usePWA } from '@/hooks/usePWA'
import { T } from '@/components/i18n/I18nProvider'

export default function PWAInstallPrompt() {
  const { theme, brand } = useBrand()
  const { isInstallable, isOffline, updateAvailable, installPWA, reloadApp } = usePWA()
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isInstallable && !dismissed) {
      const timer = setTimeout(() => {
        setShowInstallPrompt(true)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isInstallable, dismissed])

  useEffect(() => {
    if (updateAvailable) setShowUpdatePrompt(true)
  }, [updateAvailable])

  const handleInstall = async () => {
    const success = await installPWA()
    if (success) setShowInstallPrompt(false)
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    setDismissed(true)
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  const handleUpdate = () => reloadApp()

  useEffect(() => {
    const dismissedTime = localStorage.getItem('pwa-install-dismissed')
    if (dismissedTime) {
      const dayInMs = 24 * 60 * 60 * 1000
      if (Date.now() - parseInt(dismissedTime) < dayInMs) setDismissed(true)
    }
  }, [])

  return (
    <>
      {/* Install Prompt */}
      {showInstallPrompt && (
        <div className="fixed bottom-20 left-4 right-4 z-50 lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-sm">
          <div 
            className="rounded-lg shadow-lg border p-4"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.glass.border
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-2xl">📱</div>
              <div className="flex-1">
                <h4 className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>
                  {brand === 'primediscreet' ? 'Install Elite App' : 'Install EntizNet App'}
                </h4>
                <p className="text-sm mb-3" style={{ color: theme.colors.text.secondary }}>
                  {brand === 'primediscreet' 
                    ? 'Get instant access to your elite collection with our premium app experience.'
                    : 'Shop faster with our app! Get notifications for deals and quick access to your wishlist.'
                  }
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleInstall}
                    className="flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all active:scale-95"
                    style={{
                      backgroundColor: theme.colors.accent,
                      color: brand === 'primediscreet' ? theme.colors.background : 'white'
                    }}
                  >
                    Install App
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-3 py-2 rounded-lg text-sm transition-all active:scale-95"
                    style={{ color: theme.colors.text.secondary }}
                  >
                    Not now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Prompt */}
      {showUpdatePrompt && (
        <div className="fixed top-4 left-4 right-4 z-50 lg:left-auto lg:right-4 lg:max-w-sm">
          <div 
            className="rounded-lg shadow-lg border p-4"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.glass.border
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-2xl">🔄</div>
              <div className="flex-1">
                <h4 className="font-semibold mb-1" style={{ color: theme.colors.text.primary }}>
                  Update Available
                </h4>
                <p className="text-sm mb-3" style={{ color: theme.colors.text.secondary }}>
                  A new version of the app is available with improvements and fixes.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdate}
                    className="flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all active:scale-95"
                    style={{
                      backgroundColor: theme.colors.accent,
                      color: brand === 'primediscreet' ? theme.colors.background : 'white'
                    }}
                  >
                    Update Now
                  </button>
                  <button
                    onClick={() => setShowUpdatePrompt(false)}
                    className="px-3 py-2 rounded-lg text-sm transition-all active:scale-95"
                    style={{ color: theme.colors.text.secondary }}
                  >
                    Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offline Indicator */}
      {isOffline && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div 
            className="rounded-full px-4 py-2 shadow-lg border flex items-center gap-2"
            style={{
              backgroundColor: '#f59e0b',
              color: 'white',
              borderColor: '#d97706'
            }}
          >
            <span className="text-sm">📡</span>
            <span className="text-sm font-medium">
              <T k="common.offline" fallback="You're offline" />
            </span>
          </div>
        </div>
      )}
    </>
  )
}
