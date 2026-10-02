import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
import { liveQuery } from 'dexie';
import { useSyncExternalStore } from 'react';
import type { PtDb } from '../db/db';
import { syncOnce } from './engine';
import { auth, createFirestoreRemote } from './firebase';

export interface SyncState {
  configured: boolean;
  email: string | null;
  status: 'idle' | 'syncing' | 'error';
  error: string | null;
  lastSyncAt: number | null;
}

let state: SyncState = { configured: auth !== null, email: null, status: 'idle', error: null, lastSyncAt: null };
const listeners = new Set<() => void>();
function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

let attached: PtDb | null = null;
let running: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

const friendly = (e: unknown): string => {
  const code = (e as { code?: string }).code ?? '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Correo o contraseña incorrectos.';
  if (code.includes('email-already-in-use')) return 'Ese correo ya tiene cuenta: usa "Iniciar sesión".';
  if (code.includes('weak-password')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (code.includes('invalid-email')) return 'El correo no es válido.';
  if (code.includes('network') || code.includes('unavailable')) return 'Sin conexión. Se reintentará solo.';
  if (code.includes('permission-denied')) return 'Firebase rechazó el acceso: revisa las reglas de Firestore.';
  return e instanceof Error ? e.message : String(e);
};

export function syncNow(): Promise<void> {
  const user = auth?.currentUser;
  if (!attached || !user) return Promise.resolve();
  if (running) return running;
  const db = attached;
  set({ status: 'syncing', error: null });
  running = (async () => {
    try {
      await syncOnce(db, createFirestoreRemote(user.uid), user.uid);
      set({ status: 'idle', lastSyncAt: Date.now() });
    } catch (e) {
      set({ status: 'error', error: friendly(e) });
    } finally {
      running = null;
    }
  })();
  return running;
}

function syncSoon(ms: number) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), ms);
}

/** Conecta la sincronización a la base local. Devuelve la función que la desconecta. */
export function attachSync(db: PtDb): () => void {
  if (!auth) return () => {};
  attached = db;
  const offAuth = onAuthStateChanged(auth, (user) => {
    set({ email: user?.email ?? null });
    if (user) void syncNow();
  });
  // Cada cambio local nuevo (cola de subida) dispara una sincronización unos segundos después.
  const sub = liveQuery(() => db.outbox.count()).subscribe({ next: (n) => { if (n > 0) syncSoon(3000); } });
  const onVisible = () => { if (document.visibilityState === 'visible') syncSoon(500); };
  const onOnline = () => syncSoon(500);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  return () => {
    offAuth();
    sub.unsubscribe();
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
    clearTimeout(timer);
    attached = null;
  };
}

export async function signIn(email: string, password: string, create: boolean): Promise<string | null> {
  if (!auth) return 'Firebase no está configurado.';
  try {
    await (create ? createUserWithEmailAndPassword : signInWithEmailAndPassword)(auth, email, password);
    return null;
  } catch (e) {
    return friendly(e);
  }
}

export async function signOut(): Promise<void> {
  if (auth) await fbSignOut(auth);
  set({ lastSyncAt: null, status: 'idle', error: null });
}

export function useSync(): SyncState {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
  );
}
