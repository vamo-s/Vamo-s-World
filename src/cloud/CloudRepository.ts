import { openDB, type IDBPDatabase } from 'idb';
import type { AppState } from '../domain/types';
import type { StateRepository } from '../persistence/repository';
import { fingerprint, joinBlobs, splitBlobs, type Blobs } from './blobs';
import { cloud } from './cloud';

// Repositorio por usuario: copia local inmediata (funciona sin conexión) y subida a
// Firestore con una pequeña demora. Gana la versión guardada más nueva.
// Firestore: users/{uid}/state/main  { json, savedAt, schemaVersion }
//            users/{uid}/blobs/{key} { data }   (fotos y boceto)

export type SyncStatus = 'sincronizado' | 'pendiente' | 'subiendo' | 'sin-conexion' | 'error';
type Local = { state: AppState; savedAt: number; synced: boolean };

const MAX_DOC = 900_000;

export class CloudRepository implements StateRepository {
  private db: Promise<IDBPDatabase>;
  private timer?: number;
  private pending?: Local;
  private sent = new Map<string, string>();
  private listeners = new Set<(s: SyncStatus) => void>();
  status: SyncStatus = 'sincronizado';

  constructor(private uid: string, private guest?: StateRepository) {
    this.db = openDB(`vamos-house-${uid}`, 1, { upgrade: (db) => { db.createObjectStore('state'); } });
    window.addEventListener('online', () => this.pending && this.flush());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flush(); });
  }

  onStatus(cb: (s: SyncStatus) => void) { this.listeners.add(cb); cb(this.status); return () => { this.listeners.delete(cb); }; }
  private set(s: SyncStatus) { this.status = s; this.listeners.forEach((l) => l(s)); }

  private async remote(): Promise<{ state: AppState; savedAt: number } | null> {
    const { db } = await cloud();
    const { doc, getDoc, collection, getDocs } = await import('firebase/firestore');
    const main = await getDoc(doc(db, 'users', this.uid, 'state', 'main'));
    if (!main.exists()) return null;
    const { json, savedAt } = main.data() as { json: string; savedAt: number };
    const blobs: Blobs = {};
    for (const b of (await getDocs(collection(db, 'users', this.uid, 'blobs'))).docs) {
      blobs[b.id] = (b.data() as { data: string }).data;
      this.sent.set(b.id, fingerprint(blobs[b.id]));
    }
    return { state: joinBlobs(JSON.parse(json) as AppState, blobs), savedAt };
  }

  async load(): Promise<AppState | null> {
    const local = (await (await this.db).get('state', 'current')) as Local | undefined;
    let remote: Awaited<ReturnType<CloudRepository['remote']>> = null;
    try {
      remote = await Promise.race([this.remote(), new Promise<never>((_, no) => setTimeout(() => no(new Error('timeout')), 10000))]);
    } catch {
      this.set('sin-conexion');
      return local?.state ?? null; // sin red: se trabaja con la copia local y se sube después
    }
    if (local && !local.synced && (!remote || local.savedAt > remote.savedAt)) {
      this.pending = local; this.schedule();
      return local.state;
    }
    if (remote) return remote.state;
    // Cuenta nueva: se lleva la casa que había en este dispositivo como invitado.
    const fromGuest = (await this.guest?.load()) ?? null;
    if (fromGuest?.household) { this.pending = { state: fromGuest, savedAt: Date.now(), synced: false }; this.schedule(); }
    return fromGuest;
  }

  async save(state: AppState): Promise<void> {
    const local: Local = { state, savedAt: Date.now(), synced: false };
    await (await this.db).put('state', local, 'current');
    this.pending = local;
    this.set('pendiente');
    this.schedule();
  }

  private schedule() {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.flush(), 1500);
  }

  async flush(): Promise<void> {
    const p = this.pending;
    if (!p) return;
    window.clearTimeout(this.timer);
    if (!navigator.onLine) { this.set('sin-conexion'); return; }
    this.set('subiendo');
    try {
      const { db } = await cloud();
      const { doc, writeBatch } = await import('firebase/firestore');
      const { state, blobs } = splitBlobs(p.state);
      const json = JSON.stringify(state);
      if (json.length > MAX_DOC) throw new Error('Los datos superan el límite de un documento');
      const batch = writeBatch(db);
      for (const [k, v] of Object.entries(blobs)) {
        const f = fingerprint(v);
        if (this.sent.get(k) !== f) batch.set(doc(db, 'users', this.uid, 'blobs', k), { data: v });
      }
      for (const k of this.sent.keys()) if (!(k in blobs)) batch.delete(doc(db, 'users', this.uid, 'blobs', k));
      batch.set(doc(db, 'users', this.uid, 'state', 'main'), { json, savedAt: p.savedAt, schemaVersion: state.schemaVersion });
      await batch.commit();
      this.sent = new Map(Object.entries(blobs).map(([k, v]) => [k, fingerprint(v)]));
      if (this.pending === p) {
        this.pending = undefined;
        await (await this.db).put('state', { ...p, synced: true }, 'current');
        this.set('sincronizado');
      }
    } catch {
      this.set(navigator.onLine ? 'error' : 'sin-conexion');
    }
  }

  async clear(): Promise<void> {
    this.pending = undefined;
    window.clearTimeout(this.timer);
    await (await this.db).delete('state', 'current');
    const { db } = await cloud();
    const { doc, writeBatch } = await import('firebase/firestore');
    const batch = writeBatch(db);
    for (const k of this.sent.keys()) batch.delete(doc(db, 'users', this.uid, 'blobs', k));
    batch.delete(doc(db, 'users', this.uid, 'state', 'main'));
    await batch.commit();
    this.sent.clear();
    this.set('sincronizado');
  }
}
