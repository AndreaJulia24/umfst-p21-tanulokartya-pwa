//Service Worker fájl a PWA-hoz ahol a cache-elés és offline működés történik

const CACHE_NAME = 'tanulokartya-cache-v7'; // Verziószám növelése a cache frissítéséhez

const ASSETS_TO_CACHE = [
   './',
  './index.html',
  './src/ui/style.css',
  './src/ui/app.js',
  './src/db.js',
  './src/sm2.js',
  './manifest.webmanifest',
  './src/ui/assets/images/flash-card.png',
  './src/ui/assets/images/flash-cards.png',
];

// Install event: cache the assets

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Activate event: clean up old caches

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all( 
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }   
                })
            );
        })
    );
});

// Fetch event: serve cached assets if available, otherwise fetch from network
//eloszor gyorsitarozunk utana halozat

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Cache the new response for future requests
                        return caches.open(CACHE_NAME).then((cache) => {    
                            return cache.put(event.request, networkResponse.clone()).then(() => {
                                return networkResponse;
                            });
                        });
                    });
            })
    );
});