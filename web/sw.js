const CACHE_NAME = 'crypt-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/variables.css',
  '/css/app.css',
  '/css/reactions.css',
  '/css/grouping.css',
  '/js/app.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/chat.js',
  '/js/messages.js',
  '/js/crypto-client.js',
  '/js/calls.js',
  '/js/toast.js',
  '/js/search.js',
  'https://cdn.socket.io/4.8.1/socket.io.min.js',
  'https://cdn.jsdelivr.net/npm/libsodium-wrappers@0.7.15/dist/modules/libsodium-wrappers.js'
];

// Install: Cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    })
  );
});

// Fetch: Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  // Skip API and Socket.io calls
  if (event.request.url.includes('/api/') || event.request.url.includes('socket.io')) return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
