import { validateAttributes } from './attributes';
import { ASSET_TENURE, CONDITIONS } from './labels';
import {
  SCHEMA_VERSION, type AppState, type Asset, type AssetEvent, type AssetEventType,
  type HomeTenure, type Space, type SpaceKind,
} from './types';

// Operaciones de dominio puras: reciben el estado y devuelven uno nuevo. La UI y la
// persistencia no contienen reglas de negocio.

export interface Clock {
  now: () => string;
  id: () => string;
}

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
  id: () => crypto.randomUUID(),
};

export const base = (c: Clock) => {
  const t = c.now();
  return { id: c.id(), createdAt: t, updatedAt: t, schemaVersion: SCHEMA_VERSION };
};

export class DomainError extends Error {}

export const need = (cond: unknown, msg: string): void => {
  if (!cond) throw new DomainError(msg);
};

function event(s: AppState, c: Clock, assetId: string, type: AssetEventType, detail: string): AssetEvent {
  return { id: c.id(), householdId: s.household!.id, assetId, type, at: c.now(), detail, origin: 'declarado' };
}

export function setupHousehold(
  s: AppState, c: Clock,
  input: { alias: string; homeName: string; tenure: HomeTenure; isDemo?: boolean },
): AppState {
  need(input.alias.trim(), 'Falta el alias');
  need(input.homeName.trim(), 'Falta el nombre del hogar');
  return {
    ...s,
    player: { ...base(c), alias: input.alias.trim() },
    household: { ...base(c), name: input.homeName.trim(), tenure: input.tenure, isDemo: !!input.isDemo },
  };
}

export function updateHousehold(s: AppState, c: Clock, patch: { name?: string; tenure?: HomeTenure; alias?: string }): AppState {
  need(s.household && s.player, 'No hay hogar');
  return {
    ...s,
    household: { ...s.household!, ...(patch.name ? { name: patch.name.trim() } : {}), ...(patch.tenure ? { tenure: patch.tenure } : {}), updatedAt: c.now() },
    player: patch.alias ? { ...s.player!, alias: patch.alias.trim(), updatedAt: c.now() } : s.player,
  };
}

export function addSpace(s: AppState, c: Clock, input: { name: string; kind: SpaceKind; parentId?: string; isDemo?: boolean }): AppState {
  need(s.household, 'Primero creá el hogar');
  need(input.name.trim(), 'Falta el nombre del espacio');
  if (input.parentId) need(s.spaces.some((x) => x.id === input.parentId), 'El espacio padre no existe');
  const space: Space = {
    ...base(c), householdId: s.household!.id, name: input.name.trim(), kind: input.kind,
    parentId: input.parentId || undefined, isDemo: !!input.isDemo,
  };
  return { ...s, spaces: [...s.spaces, space] };
}

export function updateSpace(s: AppState, c: Clock, id: string, patch: { name?: string; kind?: SpaceKind }): AppState {
  need(s.spaces.some((x) => x.id === id), 'Espacio inexistente');
  if (patch.name !== undefined) need(patch.name.trim(), 'Falta el nombre del espacio');
  return {
    ...s,
    spaces: s.spaces.map((x) => (x.id === id ? { ...x, ...patch, name: (patch.name ?? x.name).trim(), updatedAt: c.now() } : x)),
  };
}

/** Archivar es borrado lógico: los objetos quedan, pero sin ubicación. */
export function archiveSpace(s: AppState, c: Clock, id: string): AppState {
  const t = c.now();
  const ids = new Set([id, ...s.spaces.filter((x) => x.parentId === id).map((x) => x.id)]);
  let next: AppState = {
    ...s,
    spaces: s.spaces.map((x) => (ids.has(x.id) ? { ...x, archivedAt: t, updatedAt: t } : x)),
  };
  for (const a of s.assets.filter((a) => a.spaceId && ids.has(a.spaceId) && !a.archivedAt)) {
    next = moveAsset(next, c, a.id, undefined);
  }
  return next;
}

export function restoreSpace(s: AppState, c: Clock, id: string): AppState {
  return { ...s, spaces: s.spaces.map((x) => (x.id === id ? { ...x, archivedAt: undefined, updatedAt: c.now() } : x)) };
}

export type AssetInput = Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion' | 'householdId' | 'archivedAt' | 'attributes'> & {
  attributes?: Record<string, unknown>;
};

function checkAsset(s: AppState, input: Partial<AssetInput>) {
  if (input.name !== undefined) need(input.name.trim(), 'Falta el nombre');
  if (input.spaceId) need(s.spaces.some((x) => x.id === input.spaceId && !x.archivedAt), 'El espacio no existe');
  if (input.quantity !== undefined) need(Number.isFinite(input.quantity) && input.quantity >= 0, 'Cantidad inválida');
  if (input.cost) need(Number.isFinite(input.cost.amount) && input.cost.amount >= 0, 'Costo inválido');
}

export function addAsset(s: AppState, c: Clock, input: AssetInput): AppState {
  need(s.household, 'Primero creá el hogar');
  need(input.groupId && input.subcategory, 'Falta la categoría');
  checkAsset(s, input);
  const attrs = validateAttributes(input.templateId, input.attributes ?? {});
  need(attrs.ok, 'Atributos inválidos: ' + Object.entries(attrs.errors).map(([k, v]) => `${k}: ${v}`).join(', '));
  const asset: Asset = { ...input, ...base(c), name: input.name.trim(), householdId: s.household!.id, attributes: attrs.values };
  return { ...s, assets: [...s.assets, asset], events: [...s.events, event(s, c, asset.id, 'creado', `Registrado: ${asset.name}`)] };
}

export function updateAsset(s: AppState, c: Clock, id: string, patch: Partial<AssetInput>): AppState {
  const cur = s.assets.find((a) => a.id === id);
  need(cur, 'Objeto inexistente');
  checkAsset(s, patch);
  const templateId = patch.templateId ?? cur!.templateId;
  const attrs = validateAttributes(templateId, patch.attributes ?? cur!.attributes);
  need(attrs.ok, 'Atributos inválidos: ' + Object.entries(attrs.errors).map(([k, v]) => `${k}: ${v}`).join(', '));
  const next: Asset = { ...cur!, ...patch, name: (patch.name ?? cur!.name).trim(), attributes: attrs.values, updatedAt: c.now() };
  if (next.spaceId !== cur!.spaceId) next.place = undefined;
  const evs: AssetEvent[] = [];
  if (next.spaceId !== cur!.spaceId) evs.push(event(s, c, id, 'movido', moveDetail(s, cur!.spaceId, next.spaceId)));
  if (next.condition !== cur!.condition && next.condition) evs.push(event(s, c, id, 'estado', `Estado: ${CONDITIONS[next.condition]}`));
  if (next.tenure !== cur!.tenure || next.custodian !== cur!.custodian) {
    evs.push(event(s, c, id, 'tenencia', `Tenencia: ${ASSET_TENURE[next.tenure]}${next.custodian ? ` · custodia: ${next.custodian}` : ''}`));
  }
  if (!evs.length) evs.push(event(s, c, id, 'editado', 'Datos editados'));
  return { ...s, assets: s.assets.map((a) => (a.id === id ? next : a)), events: [...s.events, ...evs] };
}

const spaceName = (s: AppState, id?: string) => (id ? s.spaces.find((x) => x.id === id)?.name ?? '?' : 'Sin ubicación');
const moveDetail = (s: AppState, from?: string, to?: string) => `${spaceName(s, from)} → ${spaceName(s, to)}`;

export function moveAsset(s: AppState, c: Clock, id: string, spaceId: string | undefined): AppState {
  const cur = s.assets.find((a) => a.id === id);
  need(cur, 'Objeto inexistente');
  if (spaceId) need(s.spaces.some((x) => x.id === spaceId && !x.archivedAt), 'El espacio no existe');
  if (cur!.spaceId === spaceId) return s;
  return {
    ...s,
    assets: s.assets.map((a) => (a.id === id ? { ...a, spaceId, place: undefined, updatedAt: c.now() } : a)),
    events: [...s.events, event(s, c, id, 'movido', moveDetail(s, cur!.spaceId, spaceId))],
  };
}

export function archiveAsset(s: AppState, c: Clock, id: string, archived = true): AppState {
  need(s.assets.some((a) => a.id === id), 'Objeto inexistente');
  const t = c.now();
  return {
    ...s,
    assets: s.assets.map((a) => (a.id === id ? { ...a, archivedAt: archived ? t : undefined, updatedAt: t } : a)),
    events: [...s.events, event(s, c, id, archived ? 'archivado' : 'restaurado', archived ? 'Archivado' : 'Restaurado')],
  };
}

export interface AssetFilter {
  text?: string;
  groupId?: string;
  spaceId?: string | 'none';
  includeArchived?: boolean;
}

export function filterAssets(s: AppState, f: AssetFilter): Asset[] {
  const q = f.text?.trim().toLowerCase();
  return s.assets.filter((a) => {
    if (!f.includeArchived && a.archivedAt) return false;
    if (f.groupId && a.groupId !== f.groupId) return false;
    if (f.spaceId === 'none' && a.spaceId) return false;
    if (f.spaceId && f.spaceId !== 'none' && a.spaceId !== f.spaceId) return false;
    if (q) {
      const hay = [a.name, a.subcategory, a.brand, a.model, a.description].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export const activeSpaces = (s: AppState) => s.spaces.filter((x) => !x.archivedAt);
