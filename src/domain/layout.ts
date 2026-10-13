import { need, type Clock } from './inventory';
import type { AppState, Rect, Space } from './types';

// Plano de la casa: cada habitación es un rectángulo en una grilla de 1 m (medidas declaradas, aproximadas).

export const LIMITS = { min: 1, max: 15, area: 40 };
const DEFAULT = 3;

export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;

const inBounds = (r: Rect) =>
  [r.x, r.y, r.w, r.d].every(Number.isInteger) && r.x >= 0 && r.y >= 0 &&
  r.w >= LIMITS.min && r.d >= LIMITS.min && r.w <= LIMITS.max && r.d <= LIMITS.max &&
  r.x + r.w <= LIMITS.area && r.y + r.d <= LIMITS.area;

/** Posición de cada habitación: la guardada o una automática en un hueco libre (filas de 3 × 3 m). */
export function resolveLayout(rooms: Space[]): Record<string, Rect> {
  const out: Record<string, Rect> = {};
  for (const r of rooms) if (r.layout) out[r.id] = r.layout;
  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(rooms.length))));
  let slot = 0;
  for (const r of rooms) {
    if (out[r.id]) continue;
    for (;;) {
      const cand = { x: (slot % cols) * DEFAULT, y: Math.floor(slot / cols) * DEFAULT, w: DEFAULT, d: DEFAULT };
      slot++;
      if (!Object.values(out).some((o) => overlaps(o, cand))) { out[r.id] = cand; break; }
    }
  }
  return out;
}

/** ¿Este rectángulo es válido para la habitación `id` (límites y sin pisar otra)? */
export function canPlace(layout: Record<string, Rect>, id: string, r: Rect): boolean {
  return inBounds(r) && !Object.entries(layout).some(([k, o]) => k !== id && overlaps(o, r));
}

/** Guarda la forma de una habitación; fija también las posiciones automáticas de las demás para que no salten. */
export function setSpaceLayout(s: AppState, c: Clock, id: string, r: Rect): AppState {
  const rooms = s.spaces.filter((x) => !x.archivedAt && !x.parentId);
  need(rooms.some((x) => x.id === id), 'Habitación inexistente');
  const layout = resolveLayout(rooms);
  need(inBounds(r), `Tamaño fuera de rango (entre ${LIMITS.min} y ${LIMITS.max} m)`);
  need(canPlace(layout, id, r), 'Se superpone con otra habitación');
  layout[id] = r;
  const t = c.now();
  return {
    ...s,
    spaces: s.spaces.map((x) => (layout[x.id] && (x.id === id || !x.layout) ? { ...x, layout: layout[x.id], updatedAt: x.id === id ? t : x.updatedAt } : x)),
  };
}
