// service-worker.js
// v25-unpkg-fix (improved)
const CACHE_NAME = 'student-data-cache-v25-unpkg-fix';

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
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css' // <-- comma fixed (last item is fine w/o trailing comma)
  // NOTE: AI files are INTENTIONALLY left out. We will fetch them live.
];

// Domains to ALWAYS fetch from network (don't cache by default)
const NETWORK_ONLY_DOMAINS = [
  'unpkg.com',          // MediaPipe JS (you chose unpkg)
  'cdn.jsdelivr.net',   // fallback CDN
  'storage.googleapis.com' // Model assets (.tflite)
];

self.addEventListener('install', event => {
  // Activate new SW immediately
  self.skipWaiting();

  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Use Promise.allSettled so one failed CDN file doesn't break install
    const results = await Promise.allSettled(
      urlsToCache.map(url => fetch(url, { mode: 'cors' }).then(resp => {
        if (!resp || !resp.ok) throw new Error(`Bad response for ${url}: ${resp && resp.status}`);
        return cache.put(url, resp.clone());
      }).catch(err => {
        console.warn('Failed to cache', url, err);
        // we don't throw here so other resources can still be cached
        return null;
      }))
    );
    console.log('Service worker installed, cache setup done.', results);
  })());
});

self.addEventListener('activate', event => {
  // take control immediately
  event.waitUntil((async () => {
    // delete old caches not matching whitelist
    const cacheWhitelist = [CACHE_NAME];
    const keys = await caches.keys();
    await Promise.all(keys.map(k => cacheWhitelist.includes(k) ? null : caches.delete(k)));
    await self.clients.claim();
    console.log('Service worker activated; old caches cleared.');
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Always allow browser extensions, devtools, etc to pass through
  if (req.url.startsWith('chrome-extension://')) return;

  // If request is for the network-only domains -> try network first, fallback to cache
  if (NETWORK_ONLY_DOMAINS.some(domain => url.hostname.includes(domain))) {
    event.respondWith((async () => {
      try {
        const netResp = await fetch(req);
        // Optionally do NOT cache these network-only responses
        return netResp;
      } catch (err) {
        // Network failed - try to return from cache (if previously cached)
        const cached = await caches.match(req);
        if (cached) return cached;
        // As last resort, return a generic Response (useful for models/files)
        return new Response('Network error', { status: 504, statusText: 'Gateway Timeout' });
      }
    })());
    return;
  }

  // For navigation requests (SPA) - try cache then fallback to index.html for offline
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cachedIndex = await caches.match('index.html');
      try {
        const networkResponse = await fetch(req);
        // Optionally update cache
        if (networkResponse && networkResponse.ok && req.method === 'GET') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, networkResponse.clone()).catch(() => {});
        }
        return networkResponse;
      } catch (err) {
        if (cachedIndex) return cachedIndex;
        return new Response('Offline', { status: 503, statusText: 'You are offline' });
      }
    })());
    return;
  }

  // Default: "Cache First" for app shell and static assets (fall back to network)
  event.respondWith((async () => {
    const cacheResp = await caches.match(req);
    if (cacheResp) return cacheResp;

    try {
      const networkResponse = await fetch(req);
      // Only cache GET and successful (200) responses (avoid caching opaque unless desired)
      if (req.method === 'GET' && networkResponse && networkResponse.ok) {
        // Avoid caching opaque responses unless you want them
        if (networkResponse.type === 'basic' || networkResponse.type === 'cors') {
          const cache = await caches.open(CACHE_NAME);
          // store a clone
          cache.put(req, networkResponse.clone()).catch(err => console.warn('Cache put failed', err));
        }
      }
      return networkResponse;
    } catch (err) {
      // network failed and nothing in cache
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
