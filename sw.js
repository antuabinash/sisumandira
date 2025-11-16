// UPDATE: v23-network-ai
// This version fixes the "0 KV" bug by ALWAYS fetching AI files from the network.
const CACHE_NAME = 'student-data-cache-v23-network-ai';

// These are the "critical" files needed to start the app.
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
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css'
  
  // NOTE: AI files are INTENTIONALLY left out. We will fetch them live.
];

// List of domains to ALWAYS fetch from network (don't cache)
const NETWORK_ONLY_DOMAINS = [
    'cdn.jsdelivr.net', // MediaPipe JS
    'storage.googleapis.com' // MediaPipe AI Model (.tflite)
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
    const requestUrl = new URL(event.request.url);

    // Check if the request is for an AI/CDN file
    if (NETWORK_ONLY_DOMAINS.some(domain => requestUrl.hostname.includes(domain))) {
        // Always go to the network for these files. Do NOT cache.
        event.respondWith(fetch(event.request));
        return; // Stop here
    }

    // For all other files (our app files), use "Cache First"
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
                        if(!response || response.status !== 200 || event.request.url.startsWith('chrome-extension')) {
                            return response;
                        }

                        // Clone the response because it's a stream
                        var responseToCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            if (event.request.method === 'GET') {
                                cache.put(event.request, responseToCache);
                            }
                        });
                        return response;
                    }
                );
            })
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
            // Delete old caches (e.g., v22, v21, etc.)
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
