import { addAsset, archiveAsset, base, need, updateAsset, type Clock } from './inventory';
import { resolveLayout } from './layout';
import type { AppState, Opening, Rect, Side } from './types';

// Puertas y ventanas: van sobre un lado de una habitación, en centímetros enteros.
// Una puerta nueva también queda registrada en el inventario (ficha "Puerta").

export const OPENING_LIMITS = {
  puerta: { minW: 50, maxW: 250, minH: 150, maxH: 300, w: 80, h: 205 },
  ventana: { minW: 30, maxW: 400, minH: 30, maxH: 250, w: 120, h: 110 },
} as const;

export const SIDE_NAME: Record<Side, string> = { n: 'arriba', e: 'derecha', s: 'abajo', w: 'izquierda' };

export const sideLength = (r: Rect, side: Side) => (side === 'n' || side === 's' ? r.w : r.d);

const rooms = (s: AppState) => s.spaces.filter((x) => !x.archivedAt && !x.parentId);

export function roomRect(s: AppState, spaceId: string): Rect | undefined {
  return resolveLayout(rooms(s))[spaceId];
}

/** Segmento de la abertura en coordenadas absolutas de la casa (dos puntos sobre la pared). */
export function openingSegment(o: Pick<Opening, 'side' | 'offset' | 'width'>, r: Rect): [number, number, number, number] {
  const a = o.offset, b = o.offset + o.width;
  switch (o.side) {
    case 'n': return [r.x + a, r.y, r.x + b, r.y];
    case 's': return [r.x + a, r.y + r.d, r.x + b, r.y + r.d];
    case 'w': return [r.x, r.y + a, r.x, r.y + b];
    case 'e': return [r.x + r.w, r.y + a, r.x + r.w, r.y + b];
  }
}

/** Si la habitación se achicó, la abertura se corre para seguir entrando (solo para dibujar). */
export function fitOpening<T extends Pick<Opening, 'side' | 'offset' | 'width'>>(o: T, r: Rect): T {
  const len = sideLength(r, o.side);
  const width = Math.min(o.width, len);
  return { ...o, width, offset: Math.max(0, Math.min(o.offset, len - width)) };
}

export type OpeningInput = Pick<Opening, 'spaceId' | 'kind' | 'side' | 'offset' | 'width' | 'height'>;

function check(s: AppState, i: OpeningInput, ignoreId?: string) {
  const r = roomRect(s, i.spaceId);
  need(r, 'La abertura tiene que estar en una habitación');
  const L = OPENING_LIMITS[i.kind];
  need(L, 'Tipo de abertura inválido');
  need(['n', 'e', 's', 'w'].includes(i.side), 'Lado inválido');
  need([i.offset, i.width, i.height].every(Number.isInteger), 'Medidas en centímetros enteros');
  need(i.width >= L.minW && i.width <= L.maxW, `Ancho entre ${L.minW} y ${L.maxW} cm`);
  need(i.height >= L.minH && i.height <= L.maxH, `Alto entre ${L.minH} y ${L.maxH} cm`);
  need(i.offset >= 0 && i.offset + i.width <= sideLength(r!, i.side), 'No entra en esa pared');
  const clash = s.openings.some((o) => o.id !== ignoreId && o.spaceId === i.spaceId && o.side === i.side && !o.archivedAt
    && i.offset < o.offset + o.width && o.offset < i.offset + i.width);
  need(!clash, 'Se superpone con otra puerta o ventana de esa pared');
}

/** Agrega una puerta o ventana. Las puertas se registran también en el inventario. */
export function addOpening(s: AppState, c: Clock, i: OpeningInput): AppState {
  need(s.household, 'Primero creá el hogar');
  check(s, i);
  let next = s;
  let assetId: string | undefined;
  if (i.kind === 'puerta') {
    const room = s.spaces.find((x) => x.id === i.spaceId)!;
    next = addAsset(next, c, {
      name: `Puerta ${room.name} (${SIDE_NAME[i.side]})`, kind: 'instalacion', groupId: 'vivienda', subcategory: 'Puerta',
      templateId: 'puerta', spaceId: i.spaceId, tenure: 'del_inmueble', origin: 'declarado',
      attributes: { ancho: i.width, alto: i.height },
    });
    assetId = next.assets.at(-1)!.id;
  }
  const o: Opening = { ...base(c), householdId: s.household!.id, ...i, assetId };
  return { ...next, openings: [...next.openings, o] };
}

export function updateOpening(s: AppState, c: Clock, id: string, patch: Partial<Omit<OpeningInput, 'kind' | 'spaceId'>> & { hinge?: Opening['hinge'] }): AppState {
  const cur = s.openings.find((o) => o.id === id && !o.archivedAt);
  need(cur, 'Abertura inexistente');
  const merged = { ...cur!, ...patch };
  check(s, merged, id);
  let next: AppState = { ...s, openings: s.openings.map((o) => (o.id === id ? { ...merged, updatedAt: c.now() } : o)) };
  const a = cur!.assetId && s.assets.find((x) => x.id === cur!.assetId);
  if (a && (patch.width !== undefined || patch.height !== undefined)) {
    next = updateAsset(next, c, a.id, { attributes: { ...a.attributes, ancho: merged.width, alto: merged.height } });
  }
  return next;
}

/** Saca la abertura del plano. Si era una puerta, su ficha se archiva (se puede restaurar desde el inventario). */
export function removeOpening(s: AppState, c: Clock, id: string): AppState {
  const cur = s.openings.find((o) => o.id === id && !o.archivedAt);
  need(cur, 'Abertura inexistente');
  const t = c.now();
  let next: AppState = { ...s, openings: s.openings.map((o) => (o.id === id ? { ...o, archivedAt: t, updatedAt: t } : o)) };
  if (cur!.assetId && next.assets.some((a) => a.id === cur!.assetId && !a.archivedAt)) next = archiveAsset(next, c, cur!.assetId);
  return next;
}

/** Aberturas vivas de habitaciones activas. */
export const liveOpenings = (s: AppState) => {
  const ids = new Set(rooms(s).map((r) => r.id));
  return s.openings.filter((o) => !o.archivedAt && ids.has(o.spaceId));
};
