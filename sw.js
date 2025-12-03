// 🔴 强制升级版本号: v162 (Single File Fix)
const CACHE_NAME = 'p1-v162-single-file';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './registry.txt',
  './modules/network/logic.js', // 现在只需要这一个文件
  './modules/ui.js',
  './modules/utils.js'
];

self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of CORE_ASSETS) {
      try { await cache.add(url); } catch (e) { console.warn('Cache fail:', url); }
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith((async () => {
    try {
      const networkResp = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, networkResp.clone());
      return networkResp;
    } catch (e) {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') return caches.match('./index.html');
      return new Response('Offline', { status: 503 });
    }
  })());
});