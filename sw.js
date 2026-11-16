const CACHE = 'vn27-v4';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'data/trip.json',
  'data/checklist.json',
  'data/budget.json',
  'data/guide.json',
  'icons/icon-180.png',
  'icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first so updates to the plan show up straight away,
// falling back to the saved copy when there's no signal.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Live exchange rates aren't worth caching.
  if (url.hostname === 'open.er-api.com') return;

  const network = fetch(e.request).then((res) => {
    if (res.ok || res.type === 'opaque') {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
    }
    return res;
  });

  const slow = new Promise((resolve) => setTimeout(resolve, 4000));

  e.respondWith(
    Promise.race([network, slow.then(() => Promise.reject(new Error('slow')))])
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then((hit) => hit || network)
        .catch(() => caches.match('index.html')))
  );
});
