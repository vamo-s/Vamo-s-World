import { validateAttributes } from '../domain/attributes';
import { ASSET_TENURE, SPACE_KINDS, HOME_TENURE, ORIGINS } from '../domain/labels';
import { TEMPLATES } from '../domain/attributes';
import { migrate, MigrationError } from '../domain/migrate';
import { SCHEMA_VERSION, emptyState, type AppState, type Asset } from '../domain/types';

// Respaldo JSON versionado. Formato: { app, schemaVersion, exportedAt, data }.

export const APP_ID = 'vamos-house';

export function exportJSON(s: AppState, now = new Date()): string {
  return JSON.stringify({ app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), data: s }, null, 2);
}

export class ImportError extends Error {}

export { migrate };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => typeof v === 'string' && v.length > 0;

export function importJSON(text: string): AppState {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new ImportError('El archivo no es JSON válido'); }
  if (!isObj(parsed) || parsed.app !== APP_ID) throw new ImportError("No es un respaldo de Vamo's House");
  const v = parsed.schemaVersion;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) throw new ImportError('Versión de esquema inválida');
  if (v > SCHEMA_VERSION) throw new ImportError(`El respaldo es de una versión más nueva (${v}). Actualizá la app.`);
  if (!isObj(parsed.data)) throw new ImportError('Respaldo sin datos');
  let d: Record<string, unknown>;
  try { d = migrate(parsed.data, v); } catch (e) { throw new ImportError(e instanceof MigrationError ? e.message : 'No se pudo migrar'); }

  const s = { ...emptyState(), ...d, schemaVersion: SCHEMA_VERSION } as AppState;
  for (const k of ['spaces', 'assets', 'events', 'tasks', 'money', 'budgets', 'holidays', 'xp', 'openings', 'projects'] as const) {
    if (!Array.isArray(s[k])) throw new ImportError(`Falta la lista "${k}"`);
  }
  if (s.household && (!str(s.household.id) || !str(s.household.name) || !(s.household.tenure in HOME_TENURE))) {
    throw new ImportError('Hogar inválido');
  }
  if (s.household?.sketch !== undefined && !(isObj(s.household.sketch) && /^data:image\//.test(String(s.household.sketch.image)))) {
    throw new ImportError('Boceto inválido');
  }
  if (s.player && (!str(s.player.id) || !str(s.player.alias))) throw new ImportError('Jugador inválido');
  const spaceIds = new Set<string>();
  for (const sp of s.spaces) {
    if (!isObj(sp) || !str(sp.id) || !str(sp.name) || !(sp.kind in SPACE_KINDS)) throw new ImportError('Espacio inválido');
    if (sp.layout !== undefined && !(isObj(sp.layout) && ['x', 'y', 'w', 'd'].every((k) => Number.isInteger((sp.layout as unknown as Record<string, unknown>)[k]))))
      throw new ImportError('Plano de espacio inválido');
    spaceIds.add(sp.id);
  }
  s.assets.forEach((a: Asset, i) => {
    const where = `Objeto ${i + 1}`;
    if (!isObj(a) || !str(a.id) || !str(a.name) || !str(a.groupId) || !str(a.subcategory)) throw new ImportError(`${where}: faltan datos mínimos`);
    if (!(a.templateId in TEMPLATES)) throw new ImportError(`${where}: plantilla desconocida`);
    if (!(a.tenure in ASSET_TENURE)) throw new ImportError(`${where}: tenencia inválida`);
    if (!(a.origin in ORIGINS)) throw new ImportError(`${where}: origen inválido`);
    if (a.spaceId && !spaceIds.has(a.spaceId)) throw new ImportError(`${where}: espacio inexistente`);
    if (a.place !== undefined && !(isObj(a.place) && ['x', 'y', 'w', 'd'].every((k) => Number.isFinite((a.place as unknown as Record<string, unknown>)[k]))))
      throw new ImportError(`${where}: ubicación en el plano inválida`);
    const r = validateAttributes(a.templateId, isObj(a.attributes) ? a.attributes : {});
    if (!r.ok) throw new ImportError(`${where}: atributos inválidos`);
  });
  const assetIds = new Set(s.assets.map((a) => a.id));
  s.tasks.forEach((t, i) => {
    if (!isObj(t) || !str(t.id) || !str(t.title) || !Array.isArray(t.log)) throw new ImportError(`Tarea ${i + 1}: datos inválidos`);
    if (t.assetId && !assetIds.has(t.assetId)) throw new ImportError(`Tarea ${i + 1}: objeto inexistente`);
  });
  s.money.forEach((m, i) => {
    if (!isObj(m) || !str(m.id) || !(m.type === 'ingreso' || m.type === 'gasto') || typeof m.amount !== 'number' || !Number.isFinite(m.amount) || m.amount <= 0)
      throw new ImportError(`Movimiento ${i + 1}: datos inválidos`);
  });
  s.openings.forEach((o, i) => {
    if (!isObj(o) || !str(o.id) || !spaceIds.has(o.spaceId) || !(o.kind === 'puerta' || o.kind === 'ventana') || !['n', 'e', 's', 'w'].includes(o.side)
      || ![o.offset, o.width, o.height].every(Number.isInteger)) throw new ImportError(`Abertura ${i + 1}: datos inválidos`);
  });
  s.projects.forEach((p, i) => {
    if (!isObj(p) || !str(p.id) || p.kind !== 'cambiar-puerta' || p.isDemo !== true) throw new ImportError(`Proyecto ${i + 1}: datos inválidos`);
  });
  const keys = new Set<string>();
  for (const e of s.xp) {
    if (!isObj(e) || !str(e.key) || typeof e.xp !== 'number') throw new ImportError('Historial de XP inválido');
    if (keys.has(e.key)) throw new ImportError('Historial de XP con recompensas duplicadas');
    keys.add(e.key);
  }
  return s;
}

const csvCell = (v: unknown) => {
  const t = v === undefined || v === null ? '' : String(v);
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** CSV de inventario (solo exportación; el respaldo completo es el JSON). */
export function inventoryCSV(s: AppState): string {
  const space = (id?: string) => s.spaces.find((x) => x.id === id)?.name ?? '';
  const head = ['id', 'nombre', 'grupo', 'subcategoria', 'tipo', 'espacio', 'cantidad', 'unidad', 'estado', 'tenencia', 'origen', 'costo_ars', 'marca', 'modelo', 'atributos', 'archivado'];
  const rows = s.assets.map((a) => [
    a.id, a.name, a.groupId, a.subcategory, a.kind, space(a.spaceId), a.quantity, a.unit, a.condition, a.tenure, a.origin,
    a.cost?.amount, a.brand, a.model, JSON.stringify(a.attributes), a.archivedAt ? 'si' : '',
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}
