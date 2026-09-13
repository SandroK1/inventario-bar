// Minimal offline cache for the bar inventory app.
// The app shell (HTML, manifest, icons) is always precached on first visit.
// The CSV library and the OCR engine's own files come from CDNs; we try to
// precache them too so they still work offline after the first successful
// visit, but a failure to do so here is never fatal — the runtime fetch
// handler below opportunistically caches anything that loads successfully
// while online, CDN scripts included.
var CACHE_NAME = 'bar-inventario-v2';
var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];
var OPTIONAL_SHELL = [
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      var required = cache.addAll(APP_SHELL);
      var optional = Promise.all(OPTIONAL_SHELL.map(function(url){
        return cache.add(url).catch(function(){ /* offline install, or CDN blocked — fine, runtime caching will pick it up later */ });
      }));
      return Promise.all([required, optional]);
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  if(event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function(cached){
      var network = fetch(event.request).then(function(resp){
        // Cache normal same-origin responses (resp.ok) and also opaque
        // cross-origin ones (CDN scripts/fonts loaded without CORS mode,
        // which report status 0 / ok:false but are still valid to reuse).
        var cacheable = resp && (resp.ok || resp.type === 'opaque');
        if(cacheable){
          var copy = resp.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        }
        return resp;
      }).catch(function(){ return cached; });
      return cached || network;
    })
  );
});
