export function toBlob(bytes: Uint8Array, mime: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type: mime });
}
