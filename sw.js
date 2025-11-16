// UPDATE: v22-listener-fix
// Decouples AI loading to fix status listeners.
// Caches essential files on install, lazy-loads heavy AI files on fetch.
const CACHE_NAME = 'student-data-cache-v22-listener-fix';

// These are the "critical" files needed to start the app.
// Heavy files (AI models) are left out and will be cached on-the-fly.
const urlsToCache = [
  './',
  'index.html',
  'app.html',
  'admin.html', 
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  
  // Firebase SDKs
  'https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore-compat.js',
  
  // Cropper.js
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css',

  // MediaPipe AI libraries (Core JS only, models will be cached on demand)
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.js'
];

// Install the service worker and cache critical files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Serve cached files when offline, and cache new requests on-the-fly
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Not in cache, fetch from network
        return fetch(event.request).then(
            (response) => {
                // Check if we got a valid response
                // Don't cache chrome extensions or invalid responses
                if(!response || response.status !== 200 || event.request.url.startsWith('chrome-extension')) {
                    return response;
                }

                // Clone the response because it's a stream and can only be consumed once
                var responseToCache = response.clone();

                caches.open(CACHE_NAME)
                    .then((cache) => {
                        // This is where we "lazy load" the AI models.
                        // When admin.html asks for them, we fetch and store them.
                        if (event.request.method === 'GET') {
                            cache.put(event.request, responseToCache);
                        }
                    });

                return response;
            }
        );
      }
    )
  );
});

// Clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Delete old caches (e.g., v21, v20, etc.)
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
