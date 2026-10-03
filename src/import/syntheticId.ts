// Las capturas de mano hechas desde el móvil no muestran el "HAND ID", pero la mano necesita
// uno y es clave única en la base. Se deriva de los bytes del archivo, de forma que volver a
// subir la misma captura dé el mismo identificador y salte el aviso de repetida.
//
// Es una huella para distinguir archivos, no un resumen criptográfico: dos FNV-1a de 32 bits
// sobre los mismos bytes, uno en cada sentido, para que el parecido entre capturas (que
// comparten casi todo el fondo) no acabe en la misma huella.

export const SYNTHETIC_PREFIX = 'img-';
const PRIME = 0x01000193;

function fnv1a(bytes: Uint8Array, seed: number, backwards: boolean): number {
  let h = seed >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    h = Math.imul(h ^ bytes[backwards ? bytes.length - 1 - i : i], PRIME) >>> 0;
  }
  return h >>> 0;
}

const hex8 = (n: number) => n.toString(16).padStart(8, '0');

export function hashBytes(bytes: Uint8Array): string {
  // La longitud entra en la semilla: dos archivos de distinto tamaño nunca empiezan igual.
  const seed = (0x811c9dc5 ^ bytes.length) >>> 0;
  return hex8(fnv1a(bytes, seed, false)) + hex8(fnv1a(bytes, 0x9e3779b9, true));
}

export function syntheticHandId(bytes: Uint8Array): string {
  return SYNTHETIC_PREFIX + hashBytes(bytes);
}

export function isSyntheticHandId(handId: string): boolean {
  return handId.startsWith(SYNTHETIC_PREFIX);
}
