/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { SHARED_CACHE } from './sharedCache';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Worker, core wasm y datos de idioma de Tesseract: se descargan la primera vez y quedan para uso offline.
registerRoute(({ url }) => url.pathname.startsWith('/tesseract/'), new CacheFirst({ cacheName: 'tesseract-assets' }));

// Destino de "Compartir" en Android: guarda las imágenes y abre la pantalla Subir.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/share-target') return;
  event.respondWith(
    (async () => {
      const form = await event.request.formData();
      const files = form.getAll('images').filter((f): f is File => f instanceof File);
      const cache = await caches.open(SHARED_CACHE);
      await Promise.all(
        files.map((f, i) =>
          cache.put(`/shared/${Date.now()}-${i}`, new Response(f, { headers: { 'content-type': f.type, 'x-last-modified': String(f.lastModified) } })),
        ),
      );
      return Response.redirect('/#/subir?shared=1', 303);
    })(),
  );
});

self.addEventListener('install', () => {
  void self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
