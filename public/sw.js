// Service Worker for EntizNetStore PWA
const CACHE_NAME = 'entiznet-store-v1'
const urlsToCache = [
  '/',
  '/entiznet',
  '/primediscreet',
  '/products',
  '/wishlist',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
]

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache')
        return cache.addAll(urlsToCache)
      })
  )
})

// Fetch event - Cache First strategy for static assets, Network First for API calls
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // API calls - Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone response for cache
          const responseClone = response.clone()
          
          // Cache successful responses
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          
          return response
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse
              }
              
              // Return offline page for API failures
              return new Response(
                JSON.stringify({ 
                  error: 'Network unavailable', 
                  offline: true 
                }),
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'application/json' }
                }
              )
            })
        })
    )
    return
  }

  // Static assets - Cache First
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(request)
          .then((fetchResponse) => {
            // Clone the response
            const responseClone = fetchResponse.clone()
            
            // Add to cache
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseClone)
              })
            
            return fetchResponse
          })
      })
      .catch(() => {
        // Fallback for offline mode
        if (request.destination === 'document') {
          return caches.match('/')
        }
        
        // Return placeholder for images
        if (request.destination === 'image') {
          return new Response(
            '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#f0f0f0"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999">Image Offline</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          )
        }
      })
  )
})

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'wishlist-sync') {
    event.waitUntil(syncWishlist())
  }
  
  if (event.tag === 'cart-sync') {
    event.waitUntil(syncCart())
  }
})

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification from EntizNetStore',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Details',
        icon: '/icons/checkmark.png'
      },
      {
        action: 'close',
        title: 'Dismiss',
        icon: '/icons/xmark.png'
      }
    ]
  }

  event.waitUntil(
    self.registration.showNotification('EntizNetStore', options)
  )
})

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/products')
    )
  }
})

// Helper functions for background sync
async function syncWishlist() {
  try {
    const wishlistData = await getStoredWishlist()
    if (wishlistData.length > 0) {
      await fetch('/api/wishlist/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: wishlistData })
      })
      await clearStoredWishlist()
    }
  } catch (error) {
    console.error('Wishlist sync failed:', error)
  }
}

async function syncCart() {
  try {
    const cartData = await getStoredCart()
    if (cartData.length > 0) {
      await fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cartData })
      })
      await clearStoredCart()
    }
  } catch (error) {
    console.error('Cart sync failed:', error)
  }
}

async function getStoredWishlist() {
  // Implementation would get data from IndexedDB
  return []
}

async function clearStoredWishlist() {
  // Implementation would clear IndexedDB data
}

async function getStoredCart() {
  // Implementation would get data from IndexedDB
  return []
}

async function clearStoredCart() {
  // Implementation would clear IndexedDB data
}