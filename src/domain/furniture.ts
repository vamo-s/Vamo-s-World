import { moveAsset, need, type Clock } from './inventory';
import { resolveLayout } from './layout';
import type { AppState, Rect } from './types';

// Capa de muebles: cada objeto ubicado tiene un rectángulo relativo a su habitación, en centímetros enteros.

/** Paso al arrastrar; con los campos numéricos se puede poner cualquier centímetro. */
export const STEP = 5;
export const MIN_ITEM = 10;
const whole = (n: number) => Number.isInteger(n);

/** Habitación principal (no zona) a la que pertenece el espacio del objeto. */
export function roomOf(s: AppState, spaceId?: string): string | undefined {
  const sp = s.spaces.find((x) => x.id === spaceId && !x.archivedAt);
  if (!sp) return undefined;
  return sp.parentId ?? sp.id;
}

/** Recorta un mueble para que quede dentro de su habitación (por si la habitación se achicó). */
export function clampPlace(p: Rect, room: Rect): Rect {
  const w = Math.min(p.w, room.w), d = Math.min(p.d, room.d);
  return { w, d, x: Math.max(0, Math.min(p.x, room.w - w)), y: Math.max(0, Math.min(p.y, room.d - d)) };
}

/**
 * Ubica (o reubica) un objeto en el plano. Si `roomId` es otra habitación, el objeto se mueve
 * a ella y queda registrado el evento de movimiento.
 */
export function placeAsset(s: AppState, c: Clock, assetId: string, roomId: string, p: Rect): AppState {
  const a = s.assets.find((x) => x.id === assetId && !x.archivedAt);
  need(a, 'Objeto inexistente');
  const rooms = s.spaces.filter((x) => !x.archivedAt && !x.parentId);
  need(rooms.some((r) => r.id === roomId), 'Habitación inexistente');
  const room = resolveLayout(rooms)[roomId];
  need([p.x, p.y, p.w, p.d].every(whole), 'Medidas en centímetros enteros');
  need(p.w >= MIN_ITEM && p.d >= MIN_ITEM, `Tamaño mínimo ${MIN_ITEM} cm`);
  need(p.x >= 0 && p.y >= 0 && p.x + p.w <= room.w && p.y + p.d <= room.d, 'El mueble tiene que quedar dentro de la habitación');
  let next = s;
  if (roomOf(s, a!.spaceId) !== roomId) next = moveAsset(next, c, assetId, roomId);
  return { ...next, assets: next.assets.map((x) => (x.id === assetId ? { ...x, place: p, updatedAt: c.now() } : x)) };
}

export function unplaceAsset(s: AppState, c: Clock, assetId: string): AppState {
  need(s.assets.some((x) => x.id === assetId), 'Objeto inexistente');
  return { ...s, assets: s.assets.map((x) => (x.id === assetId ? { ...x, place: undefined, updatedAt: c.now() } : x)) };
}

/** Primer lugar libre (por defecto 60 × 60 cm) dentro de la habitación, o la esquina si está llena. */
export function freeSpot(s: AppState, roomId: string, room: Rect, want = { w: 60, d: 60 }): Rect {
  const taken = s.assets.filter((a) => !a.archivedAt && a.place && roomOf(s, a.spaceId) === roomId).map((a) => a.place!);
  const w = Math.min(want.w, room.w), d = Math.min(want.d, room.d);
  for (let y = 0; y + d <= room.d; y += 10) for (let x = 0; x + w <= room.w; x += 10) {
    const r = { x, y, w, d };
    if (!taken.some((t) => r.x < t.x + t.w && t.x < r.x + r.w && r.y < t.y + t.d && t.y < r.y + r.d)) return r;
  }
  return { x: 0, y: 0, w, d };
}
