const CACHE_NAME = 'p1-v1.0.3-fix-cache-sync'; // 升级版本号

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// 安装
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of CORE_ASSETS) {
      try {
        await cache.add(url);
      } catch (e) {
        console.warn('[SW] Failed to cache', url, e);
      }
    }
    // 强制立即接管，跳过等待
    self.skipWaiting();
  })());
});

// 激活：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())
    )).then(() => self.clients.claim()) // 立即控制所有页面
  );
});

// 请求拦截
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 页面导航：网络优先
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        return fresh;
      } catch (e) {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match('./index.html');
        if (cached) return cached;
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // 同源 GET：网络优先 (确保加载最新JS)
  if (url.origin === self.location.origin && req.method === 'GET') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // 跨域 (CDN)：网络优先
  if (req.method === 'GET') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
  }
});