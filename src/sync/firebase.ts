import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  collection, deleteDoc, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, serverTimestamp, setDoc, Timestamp, where, writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { SyncKind } from '../db/db';
import type { Remote, RemoteImage, RemoteRecord } from './remote';

function readConfig(): FirebaseOptions | null {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined;
  if (!raw) return null;
  try {
    const cfg = JSON.parse(raw) as FirebaseOptions;
    return cfg.apiKey && cfg.projectId ? cfg : null;
  } catch {
    return null;
  }
}

const config = readConfig();
const app = config ? initializeApp(config) : null;

/** `null` si la app se compila sin la configuración de Firebase: entonces funciona solo en local, como antes. */
export const auth: Auth | null = app ? getAuth(app) : null;
const firestore: Firestore | null = app ? getFirestore(app) : null;

// Firestore limita cada documento a 1 MiB: las capturas se parten en trozos de 512 KiB (≈700 KB en base64).
const IMAGE_PART_BYTES = 512 * 1024;

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const cursorOf = (t: Timestamp) => `${t.seconds}:${t.nanoseconds}`;
function timestampOf(cursor: string | null): Timestamp {
  if (!cursor) return new Timestamp(0, 0);
  const [s, n] = cursor.split(':').map(Number);
  return new Timestamp(s, n);
}

export function createFirestoreRemote(uid: string): Remote {
  if (!firestore) throw new Error('Firebase no está configurado');
  const fs = firestore;
  const records = collection(fs, 'users', uid, 'records');
  const imageDoc = (id: string) => doc(fs, 'users', uid, 'images', id);
  const partsOf = (id: string) => collection(fs, 'users', uid, 'images', id, 'parts');

  return {
    async putRecords(rows) {
      const batch = writeBatch(fs);
      for (const r of rows) {
        batch.set(doc(records, `${r.kind}__${r.id}`), { kind: r.kind, id: r.id, json: r.json, deleted: r.deleted, updatedAt: serverTimestamp() });
      }
      await batch.commit();
    },

    async pullRecords(after, max) {
      const snap = await getDocs(query(records, where('updatedAt', '>', timestampOf(after)), orderBy('updatedAt'), limit(max)));
      return snap.docs.map((d): RemoteRecord => {
        const v = d.data();
        return { kind: v.kind as SyncKind, id: v.id as string, json: v.json as string, deleted: v.deleted as boolean, cursor: cursorOf(v.updatedAt as Timestamp) };
      });
    },

    async putImage(id, img: RemoteImage) {
      const parts = Math.max(1, Math.ceil(img.bytes.length / IMAGE_PART_BYTES));
      for (let i = 0; i < parts; i++) {
        await setDoc(doc(partsOf(id), String(i)), { b64: toBase64(img.bytes.subarray(i * IMAGE_PART_BYTES, (i + 1) * IMAGE_PART_BYTES)) });
      }
      // La ficha va al final: mientras no exista, nadie intenta leer una imagen a medio subir.
      await setDoc(imageDoc(id), { mime: img.mime, width: img.width, height: img.height, parts });
    },

    async getImage(id) {
      const meta = await getDoc(imageDoc(id));
      if (!meta.exists()) return null;
      const { mime, width, height, parts } = meta.data() as { mime: string; width: number; height: number; parts: number };
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < parts; i++) {
        const part = await getDoc(doc(partsOf(id), String(i)));
        if (!part.exists()) return null;
        chunks.push(fromBase64(part.data().b64 as string));
      }
      const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.length;
      }
      return { bytes, mime, width, height };
    },

    async deleteImage(id) {
      const meta = await getDoc(imageDoc(id));
      if (!meta.exists()) return;
      const parts = (meta.data() as { parts: number }).parts;
      for (const p of (await getDocs(partsOf(id))).docs.slice(0, Math.max(parts, 1) + 5)) await deleteDoc(p.ref);
      await deleteDoc(imageDoc(id));
    },
  };
}
