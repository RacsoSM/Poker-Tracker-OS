import { SHARED_CACHE } from '../sharedCache';
import type { IncomingFile } from './pipeline';

// Lee y vacía las imágenes que el service worker guardó al recibir "Compartir".
export async function takeSharedFiles(): Promise<IncomingFile[]> {
  if (!('caches' in window)) return [];
  const cache = await caches.open(SHARED_CACHE);
  const out: IncomingFile[] = [];
  for (const req of await cache.keys()) {
    const res = await cache.match(req);
    if (res) {
      const blob = await res.blob();
      out.push({
        bytes: new Uint8Array(await blob.arrayBuffer()),
        mime: blob.type || res.headers.get('content-type') || 'image/png',
        lastModified: Number(res.headers.get('x-last-modified')) || Date.now(),
        name: req.url,
      });
    }
    await cache.delete(req);
  }
  return out;
}
