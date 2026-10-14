import { archiveSpace, need, type Clock } from './inventory';
import { LIMITS, LOT, addRoomAt, lotOf, overlaps, resolveLayout, setSketch } from './layout';
import { OPENING_LIMITS, addOpening, liveOpenings, removeOpening, sideLength } from './openings';
import type { AppState, Rect, Side, Sketch, SpaceKind } from './types';

// Plano desde una foto: la IA devuelve un borrador (habitaciones en cm) que el usuario revisa
// antes de guardarlo. Acá se limpia ese borrador y se aplica a la casa.

export const PLAN_KINDS: SpaceKind[] = ['cocina', 'dormitorio', 'bano', 'lavadero', 'escritorio', 'living', 'garaje', 'patio', 'deposito', 'otro'];
const SIDES: Side[] = ['n', 'e', 's', 'w'];
const GRID = 10;
/** Superposición que se corrige recortando (paredes dibujadas con poca precisión). */
const TRIM = 60;

export interface DraftRoom extends Rect { name: string; kind: SpaceKind }
export interface DraftOpening { room: number; kind: 'puerta' | 'ventana'; side: Side; offset: number; width: number }
export interface PlanDraft {
  rooms: DraftRoom[];
  openings: DraftOpening[];
  /** Caja del edificio en la foto, en milésimos de la imagen (para usarla de fondo). */
  box?: { x0: number; y0: number; x1: number; y1: number };
  notes?: string;
  /** Habitaciones que la IA propuso pero no se pudieron usar. */
  dropped: number;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
const g = (n: number) => Math.round(n / GRID) * GRID;

export const draftBounds = (rooms: Rect[]) => ({
  w: Math.max(0, ...rooms.map((r) => r.x + r.w)),
  d: Math.max(0, ...rooms.map((r) => r.y + r.d)),
});

/** Recorta la habitación `r` para que no pise a `o`, si la superposición es chica. */
function trim(r: Rect, o: Rect): Rect | null {
  const ox = Math.min(r.x + r.w, o.x + o.w) - Math.max(r.x, o.x);
  const oy = Math.min(r.y + r.d, o.y + o.d) - Math.max(r.y, o.y);
  if (ox <= oy && ox <= TRIM) return r.x < o.x ? { ...r, w: r.w - ox } : { ...r, x: r.x + ox, w: r.w - ox };
  if (oy <= TRIM) return r.y < o.y ? { ...r, d: r.d - oy } : { ...r, y: r.y + oy, d: r.d - oy };
  return null;
}

/** Limpia la respuesta de la IA: cm enteros cada 10, sin superposiciones, todo desde (0,0). */
export function normalizeDraft(raw: unknown): PlanDraft {
  const o = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(o.rooms) ? o.rooms : [];
  const kept: DraftRoom[] = [];
  const index = new Map<number, number>();
  list.forEach((it, i) => {
    const x = it as Record<string, unknown>;
    let r: Rect | null = { x: g(Math.max(0, num(x.x))), y: g(Math.max(0, num(x.y))), w: g(num(x.w)), d: g(num(x.d)) };
    if (![r.x, r.y, r.w, r.d].every(Number.isFinite)) return;
    for (const k of kept) {
      if (!r || !overlaps(r, k)) continue;
      r = trim(r, k);
    }
    if (!r || kept.some((k) => overlaps(r!, k))) return;
    if (r.w < LIMITS.min || r.d < LIMITS.min || r.w > LIMITS.max || r.d > LIMITS.max) return;
    const name = typeof x.name === 'string' && x.name.trim() ? x.name.trim().slice(0, 40) : `Ambiente ${kept.length + 1}`;
    const kind = PLAN_KINDS.includes(x.kind as SpaceKind) ? (x.kind as SpaceKind) : 'otro';
    index.set(i, kept.length);
    kept.push({ ...r, name, kind });
  });
  // Corre todo para que arranque en (0,0).
  const mx = Math.min(...kept.map((r) => r.x)), my = Math.min(...kept.map((r) => r.y));
  const rooms = kept.map((r) => ({ ...r, x: r.x - (kept.length ? mx : 0), y: r.y - (kept.length ? my : 0) }));

  const openings: DraftOpening[] = [];
  for (const it of Array.isArray(o.openings) ? o.openings : []) {
    const x = it as Record<string, unknown>;
    const room = index.get(num(x.room));
    const kind = x.kind === 'puerta' || x.kind === 'ventana' ? x.kind : undefined;
    const side = SIDES.includes(x.side as Side) ? (x.side as Side) : undefined;
    if (room === undefined || !kind || !side) continue;
    const L = OPENING_LIMITS[kind];
    const len = sideLength(rooms[room], side);
    const width = Math.min(len, Math.max(L.minW, Math.round(num(x.width) || L.w)));
    if (width < L.minW) continue;
    const offset = Math.max(0, Math.min(len - width, Math.round(num(x.offset) || 0)));
    const clash = openings.some((p) => p.room === room && p.side === side && offset < p.offset + p.width && p.offset < offset + width);
    if (!clash) openings.push({ room, kind, side, offset, width });
  }

  const b = o.box as Record<string, unknown> | undefined;
  const box = b && [b.x0, b.y0, b.x1, b.y1].every((v) => Number.isFinite(num(v))) && num(b.x1) > num(b.x0) && num(b.y1) > num(b.y0)
    ? { x0: num(b.x0), y0: num(b.y0), x1: num(b.x1), y1: num(b.y1) } : undefined;
  return {
    rooms, openings, box, dropped: list.length - rooms.length,
    notes: typeof o.notes === 'string' ? o.notes.slice(0, 300) : undefined,
  };
}

/** Escala todo el borrador (ej. "el frente mide 9 m" cuando la IA calculó 8,4). */
export function scaleDraft(d: PlanDraft, k: number): PlanDraft {
  need(Number.isFinite(k) && k > 0.2 && k < 5, 'Escala inválida');
  const raw = {
    rooms: d.rooms.map((r) => ({ ...r, x: r.x * k, y: r.y * k, w: r.w * k, d: r.d * k })),
    openings: d.openings.map((o) => ({ ...o, offset: o.offset * k, width: o.width })),
    box: d.box, notes: d.notes,
  };
  return { ...normalizeDraft(raw), dropped: d.dropped };
}

/** Saca una habitación del borrador (y sus aberturas). */
export function dropDraftRoom(d: PlanDraft, i: number): PlanDraft {
  return {
    ...d,
    rooms: d.rooms.filter((_, k) => k !== i),
    openings: d.openings.filter((o) => o.room !== i).map((o) => ({ ...o, room: o.room > i ? o.room - 1 : o.room })),
  };
}

const liveRooms = (s: AppState) => s.spaces.filter((x) => !x.archivedAt && !x.parentId);

/**
 * Pasa el borrador al plano. `replace`: archiva las habitaciones actuales (se pueden restaurar
 * desde el inventario). Si no, el plano nuevo va al lado del existente. El terreno se agranda si hace falta.
 */
export function importPlan(s: AppState, c: Clock, d: PlanDraft, opts: { replace: boolean; sketch?: Sketch }): AppState {
  need(s.household, 'Primero creá el hogar');
  need(d.rooms.length > 0, 'El plano no tiene habitaciones');
  let next = s;
  if (opts.replace) {
    for (const o of liveOpenings(next)) next = removeOpening(next, c, o.id);
    for (const r of liveRooms(next)) next = archiveSpace(next, c, r.id);
  }
  const current = Object.values(resolveLayout(liveRooms(next)));
  const dx = current.length ? Math.ceil((draftBounds(current).w + 100) / GRID) * GRID : 0;
  const rooms = d.rooms.map((r) => ({ ...r, x: r.x + dx }));
  const b = draftBounds(rooms);
  need(b.w <= LIMITS.area && b.d <= LIMITS.area, `No entra en ${LIMITS.area / 100} × ${LIMITS.area / 100} m`);

  const lot = lotOf(next);
  const up = (n: number) => Math.min(LOT.max, Math.ceil(n / LOT.step) * LOT.step);
  const want = { w: Math.max(lot.w, up(b.w + 200)), d: Math.max(lot.d, up(b.d + 200)) };
  next = { ...next, household: { ...next.household!, lot: want, updatedAt: c.now() } };

  const ids: string[] = [];
  for (const r of rooms) {
    next = addRoomAt(next, c, { name: r.name, kind: r.kind, rect: { x: r.x, y: r.y, w: r.w, d: r.d } });
    ids.push(next.spaces.at(-1)!.id);
  }
  for (const o of d.openings) {
    const L = OPENING_LIMITS[o.kind];
    try {
      next = addOpening(next, c, { spaceId: ids[o.room], kind: o.kind, side: o.side, offset: o.offset, width: o.width, height: L.h });
    } catch { /* una abertura dudosa no frena el plano */ }
  }
  if (opts.sketch) next = setSketch(next, c, { ...opts.sketch, x: opts.sketch.x + dx });
  return next;
}
