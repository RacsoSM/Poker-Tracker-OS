import { toBlob } from '../image/blob';

export function saveFile(bytes: Uint8Array, name: string, mime: string): void {
  const url = URL.createObjectURL(toBlob(bytes, mime));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
