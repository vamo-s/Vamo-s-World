import { addSpace, need, type Clock } from './inventory';
import type { AppState, Rect, Sketch, Space, SpaceKind } from './types';

// Plano de la casa: cada habitación es un rectángulo en centímetros (medidas declaradas por el usuario).

/** Centímetros: lado mínimo 50 cm, máximo 30 m; la casa entra en 60 × 60 m. */
export const LIMITS = { min: 50, max: 3000, area: 6000 };
export const ROOM_STEP = 10;
const DEFAULT = 300;

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
  need(inBounds(r), `Tamaño fuera de rango (cada lado entre ${LIMITS.min} cm y ${LIMITS.max / 100} m)`);
  need(canPlace(layout, id, r), 'Se superpone con otra habitación');
  layout[id] = r;
  const t = c.now();
  return {
    ...s,
    spaces: s.spaces.map((x) => (layout[x.id] && (x.id === id || !x.layout) ? { ...x, layout: layout[x.id], updatedAt: x.id === id ? t : x.updatedAt } : x)),
  };
}

/** Modo construcción: crea una habitación ya dibujada en el plano (boceto → plano). */
export function addRoomAt(s: AppState, c: Clock, input: { name: string; kind: SpaceKind; rect: Rect }): AppState {
  const rooms = s.spaces.filter((x) => !x.archivedAt && !x.parentId);
  need(inBounds(input.rect), `Tamaño fuera de rango (cada lado entre ${LIMITS.min} cm y ${LIMITS.max / 100} m)`);
  need(!Object.values(resolveLayout(rooms)).some((o) => overlaps(o, input.rect)), 'Se superpone con otra habitación');
  // Fija primero las posiciones automáticas para que la nueva no las desplace.
  const fixed = resolveLayout(rooms);
  const pinned: AppState = { ...s, spaces: s.spaces.map((x) => (fixed[x.id] && !x.layout ? { ...x, layout: fixed[x.id] } : x)) };
  const next = addSpace(pinned, c, { name: input.name, kind: input.kind });
  const id = next.spaces.at(-1)!.id;
  return { ...next, spaces: next.spaces.map((x) => (x.id === id ? { ...x, layout: input.rect } : x)) };
}

/** Fondo de boceto: una foto del dibujo a mano para calcar encima. `undefined` lo quita. */
export function setSketch(s: AppState, c: Clock, sketch: Sketch | undefined): AppState {
  need(s.household, 'Primero creá el hogar');
  if (sketch) {
    need(/^data:image\/(png|jpeg|webp);base64,/.test(sketch.image), 'Imagen inválida');
    need(sketch.image.length < 900_000, 'La imagen es muy pesada');
    need([sketch.x, sketch.y, sketch.w].every(Number.isFinite) && sketch.w >= 100 && sketch.w <= LIMITS.area, 'Escala del boceto inválida');
    need(sketch.opacity >= 0.1 && sketch.opacity <= 1, 'Opacidad inválida');
  }
  return { ...s, household: { ...s.household!, sketch, updatedAt: c.now() } };
}
