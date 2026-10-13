import { openDB, type IDBPDatabase } from 'idb';
import type { AppState } from '../domain/types';

/**
 * Puerto de persistencia. Hoy: IndexedDB local. Mañana: un adaptador Supabase/PostgreSQL
 * que implemente la misma interfaz (ver DECISIONS.md).
 */
export interface StateRepository {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryRepository implements StateRepository {
  private data: string | null = null;
  async load() { return this.data ? (JSON.parse(this.data) as AppState) : null; }
  async save(s: AppState) { this.data = JSON.stringify(s); }
  async clear() { this.data = null; }
}

const STORE = 'state';
const KEY = 'current';

export class IndexedDbRepository implements StateRepository {
  private db: Promise<IDBPDatabase>;
  constructor(name = 'vamos-house') {
    this.db = openDB(name, 1, { upgrade: (db) => { db.createObjectStore(STORE); } });
  }
  async load() { return ((await (await this.db).get(STORE, KEY)) as AppState | undefined) ?? null; }
  async save(s: AppState) { await (await this.db).put(STORE, s, KEY); }
  async clear() { await (await this.db).delete(STORE, KEY); }
}
