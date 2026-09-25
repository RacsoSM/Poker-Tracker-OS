import { toBlob } from '../image/blob';
import type { RGBA } from '../image/rgba';
import type { IncomingFile } from './pipeline';

// Solo navegador. Sin conversión de color para no alterar los umbrales de visión.
export async function decodeImageFile(f: IncomingFile): Promise<RGBA> {
  const bmp = await createImageBitmap(toBlob(f.bytes, f.mime), { colorSpaceConversion: 'none' });
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo leer la imagen');
  ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, bmp.width, bmp.height);
  bmp.close();
  return { width: d.width, height: d.height, data: d.data };
}
