// Service Worker for EntizNetStore PWA
const CACHE_NAME = "entiznet-store-v2";
const ORIGIN = self.location.origin;

// Precache a small core shell (avoid large/fragile media)
const urlsToCache = [
  "/",
  "/entiznet",
  "/primediscreet",
  "/products",
  "/wishlist",
  "/manifest.json",
  // Keep static bundles if they exist; ignore errors if not present
  "/static/js/bundle.js",
  "/static/css/main.css",
];

// ----- Install -----
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(urlsToCache);
      } catch (e) {
        // Some URLs might not exist in all builds — ignore
        // console.warn('SW install: some precache entries failed', e);
      } finally {
        self.skipWaiting();
      }
    })(),
  );
});

// ----- Activate -----
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.map((name) =>
          name !== CACHE_NAME ? caches.delete(name) : undefined,
        ),
      );
      await self.clients.claim();
    })(),
  );
});

// ----- Fetch -----
// Strategy:
//  - BYPASS videos and Range (partial) requests: let network handle directly
//  - API: Network-first (then cache on success)
//  - Same-origin static GET: Cache-first (then update cache in background)
//  - Other methods/origins: pass-through
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1) Let the network handle:
  //    - Range requests (partial content) to avoid 416 loops
  //    - Any video requests
  //    - Non-GET methods
  //    - Explicit /videos/* path
  if (
    request.headers.has("range") ||
    request.destination === "video" ||
    url.pathname.startsWith("/videos/") ||
    request.method !== "GET"
  ) {
    // No respondWith => browser handles normally
    return;
  }

  // 2) API (Network-first)
  if (url.origin === ORIGIN && url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 3) Same-origin static (Cache-first)
  if (url.origin === ORIGIN) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 4) Cross-origin: pass-through (avoid caching opaque responses by default)
  // If you want to cache specific CDNs, whitelist them above.
  return;
});

// ----- Strategies -----
async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    // Cache only successful, basic/cors responses
    if (
      fresh &&
      fresh.status === 200 &&
      (fresh.type === "basic" || fresh.type === "cors")
    ) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Fallback JSON for API
    return new Response(
      JSON.stringify({ error: "Network unavailable", offline: true }),
      {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

async function cacheFirst(request) {
  // Avoid caching large/fragile media types here (we already bypass videos)
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const resp = await fetch(request);
    // Only cache successful, same-origin, cachable responses
    if (
      resp &&
      resp.status === 200 &&
      (resp.type === "basic" || resp.type === "cors")
    ) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, resp.clone());
    }
    return resp;
  } catch (err) {
    // Offline fallbacks
    if (request.destination === "document") {
      // App shell fallback
      const root = await caches.match("/");
      if (root) return root;
    }
    if (request.destination === "image") {
      // Lightweight SVG placeholder
      return new Response(
        '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#f0f0f0"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999" font-family="sans-serif" font-size="14">Image Offline</text></svg>',
        { headers: { "Content-Type": "image/svg+xml" } },
      );
    }
    // Otherwise propagate error
    throw err;
  }
}

// ----- Background Sync -----
self.addEventListener("sync", (event) => {
  if (event.tag === "wishlist-sync") {
    event.waitUntil(syncWishlist());
  } else if (event.tag === "cart-sync") {
    event.waitUntil(syncCart());
  }
});

// ----- Push Notifications -----
self.addEventListener("push", (event) => {
  const options = {
    body: event.data
      ? event.data.text()
      : "New notification from EntizNetStore",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: "explore",
        title: "View Details",
        icon: "/icons/checkmark.png",
      },
      { action: "close", title: "Dismiss", icon: "/icons/xmark.png" },
    ],
  };

  event.waitUntil(self.registration.showNotification("EntizNetStore", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "explore") {
    event.waitUntil(clients.openWindow("/products"));
  }
});

// ----- Helpers for background sync (stubbed for IndexedDB integration) -----
async function syncWishlist() {
  try {
    const wishlistData = await getStoredWishlist();
    if (wishlistData.length > 0) {
      await fetch("/api/wishlist/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: wishlistData }),
      });
      await clearStoredWishlist();
    }
  } catch (error) {
    console.error("Wishlist sync failed:", error);
  }
}

async function syncCart() {
  try {
    const cartData = await getStoredCart();
    if (cartData.length > 0) {
      await fetch("/api/cart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cartData }),
      });
      await clearStoredCart();
    }
  } catch (error) {
    console.error("Cart sync failed:", error);
  }
}

async function getStoredWishlist() {
  // TODO: implement IndexedDB read
  return [];
}
async function clearStoredWishlist() {
  // TODO: implement IndexedDB clear
}
async function getStoredCart() {
  // TODO: implement IndexedDB read
  return [];
}
async function clearStoredCart() {
  // TODO: implement IndexedDB clear
}
