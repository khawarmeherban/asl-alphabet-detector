// Advanced Service Worker for ASL Detector PWA
// Version: 2.0.0

const CACHE_NAME = 'asl-detector-v2.0.0';
const RUNTIME_CACHE = 'asl-runtime-v2';
const MEDIAPIPE_CACHE = 'mediapipe-models-v1';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// MediaPipe models and resources
const MEDIAPIPE_URLS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    Promise.all([
      // Cache core app assets
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Precaching app assets');
        return cache.addAll(PRECACHE_ASSETS.map(url => new Request(url, { cache: 'reload' })));
      }).catch(err => {
        console.warn('[SW] Precaching failed for some assets:', err);
      }),
      
      // Prefetch MediaPipe resources
      caches.open(MEDIAPIPE_CACHE).then((cache) => {
        console.log('[SW] Caching MediaPipe models');
        return Promise.allSettled(
          MEDIAPIPE_URLS.map(url => 
            fetch(url).then(response => cache.put(url, response)).catch(err => {
              console.warn(`[SW] Failed to cache ${url}:`, err);
            })
          )
        );
      })
    ]).then(() => {
      console.log('[SW] Installation complete');
      return self.skipWaiting(); // Activate immediately
    })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name !== CACHE_NAME && 
                   name !== RUNTIME_CACHE && 
                   name !== MEDIAPIPE_CACHE;
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim(); // Take control immediately
    })
  );
});

// Fetch event - advanced caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other protocols
  if (!url.protocol.startsWith('http')) return;

  // Skip API calls (let them go to network)
  if (url.pathname.startsWith('/api') || url.port === '5000') {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Strategy: Cache-first for static assets, Network-first for HTML
      
      if (request.destination === 'document') {
        // Network-first strategy for HTML
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            return cachedResponse || caches.match('/index.html');
          });
      }

      // Cache-first strategy for other resources
      if (cachedResponse) {
        // Return cached version immediately
        // Update cache in background
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Network failed, but we have cache
          });
        
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // Cache successful responses
          const responseClone = networkResponse.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });

          return networkResponse;
        })
        .catch((error) => {
          console.error('[SW] Fetch failed:', error);
          
          // Return offline page if available
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
          
          throw error;
        });
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-detections') {
    event.waitUntil(syncDetectionData());
  }
});

// Push notification support
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'ASL Detector';
  const options = {
    body: data.body || 'New notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

// Helper function to sync detection data
async function syncDetectionData() {
  try {
    // Implement your sync logic here
    console.log('[SW] Syncing detection data...');
    // This would typically send cached detection data to the server
    return Promise.resolve();
  } catch (error) {
    console.error('[SW] Sync failed:', error);
    throw error;
  }
}

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CACHE_IMAGE') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.add(event.data.url);
      })
    );
  }

  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((names) => {
        return Promise.all(names.map((name) => caches.delete(name)));
      })
    );
  }
});

console.log('[SW] Service Worker script loaded');
