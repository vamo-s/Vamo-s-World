import { useEffect, useRef, useState } from 'react';
import { MIN_ITEM, STEP, clampPlace, freeSpot, placeAsset, roomOf, unplaceAsset } from '../domain/furniture';
import { ROOM_STEP, canPlace, resolveLayout, setSpaceLayout } from '../domain/layout';
import { fitOpening, liveOpenings, openingSegment } from '../domain/openings';
import type { Asset, Rect, Space } from '../domain/types';
import { useStore } from '../state/store';
import { SPACE_ICON } from './common';

// Plano isométrico con dos capas: Espacios (forma de las habitaciones) y Muebles (objetos del inventario).
// Todo se guarda en centímetros; 1 m de grilla = U px a lo ancho y V px a lo alto (proyección 2:1).
const U = 22, V = 11, WALL = 18, BOX = 9, LONG_PRESS = 450, MOVE_TOL = 8;
const COLORS: Record<string, string> = {
  cocina: '#f6c48f', dormitorio: '#b9c8f5', bano: '#9fe0e0', lavadero: '#c7e8a8', escritorio: '#e5c3f2',
  living: '#f5b7b1', garaje: '#cfd3d8', patio: '#a6dba0', deposito: '#e2cfa8', otro: '#e8e2d0',
};

export type Layer = 'espacios' | 'muebles';
type Kind = 'room' | 'item';
type Target = { kind: Kind; id: string };
type Drag = { mode: 'move' | 'w' | 'd'; sx: number; sy: number; start: Rect };

const P = (gx: number, gy: number): [number, number] => [((gx - gy) / 100) * U, ((gx + gy) / 100) * V];
const pts = (...ps: [number, number][]) => ps.map((p) => p.join(',')).join(' ');
const lift = ([x, y]: [number, number], h: number): [number, number] => [x, y - h];
const inside = (r: Rect, o: Rect) => r.x >= o.x && r.y >= o.y && r.x + r.w <= o.x + o.w && r.y + r.d <= o.y + o.d;
const cm = (r: Rect) => `${r.w} × ${r.d} cm`;

export function IsoHouse({ rooms, counts, selected, onSelect, onOpenAsset, alias, layer }: {
  rooms: Space[]; counts: Record<string, number>; selected?: string; alias: string; layer: Layer;
  onSelect: (id: string) => void; onOpenAsset: (id: string) => void;
}) {
  const { state, run, notify } = useStore();
  const svg = useRef<SVGSVGElement>(null);
  const [target, setTarget] = useState<Target>();
  const [draft, setDraft] = useState<Rect>();
  const drag = useRef<Drag | null>(null);
  const press = useRef<{ kind: Kind; id: string; x: number; y: number; timer: number } | null>(null);
  const frozenBox = useRef<string | null>(null);

  // Al cambiar de capa se sale de la edición.
  useEffect(() => { setTarget(undefined); setDraft(undefined); frozenBox.current = null; }, [layer]);

  // Mientras se arrastra, el dedo mueve el elemento en vez de desplazar la página.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const stop = (e: TouchEvent) => { if (drag.current) e.preventDefault(); };
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, []);

  const baseLayout = resolveLayout(rooms);
  const layout = { ...baseLayout };
  if (target?.kind === 'room' && draft) layout[target.id] = draft;

  // Muebles en coordenadas absolutas de la casa.
  const items: { asset: Asset; rect: Rect }[] = [];
  for (const a of state.assets) {
    if (a.archivedAt || !a.place) continue;
    const rid = roomOf(state, a.spaceId);
    const room = rid && layout[rid];
    if (!room) continue;
    const p = clampPlace(a.place, room);
    const rect = target?.kind === 'item' && target.id === a.id && draft ? draft : { x: room.x + p.x, y: room.y + p.y, w: p.w, d: p.d };
    items.push({ asset: a, rect });
  }
  const openings = liveOpenings(state);
  const unplaced = layer === 'muebles'
    ? state.assets.filter((a) => !a.archivedAt && !a.place && roomOf(state, a.spaceId) && layout[roomOf(state, a.spaceId)!])
    : [];

  // Encuadre: todas las habitaciones + margen; al editar habitaciones, 3 m extra para poder crecer.
  const pad = target?.kind === 'room' ? 300 : 0;
  const corners = Object.values(layout).flatMap((r) => [P(r.x - pad, r.y - pad), P(r.x + r.w + pad, r.y - pad), P(r.x + r.w + pad, r.y + r.d + pad), P(r.x - pad, r.y + r.d + pad)]);
  const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
  const liveBox = `${Math.min(...xs) - 12} ${Math.min(...ys) - WALL - 16} ${Math.max(...xs) - Math.min(...xs) + 24} ${Math.max(...ys) - Math.min(...ys) + WALL + 32}`;
  const viewBox = frozenBox.current ?? liveBox;

  const toSvg = (cx: number, cy: number) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return { x: cx, y: cy };
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const rectOf = (t: Target): Rect | undefined => (t.kind === 'room' ? layout[t.id] : items.find((i) => i.asset.id === t.id)?.rect);
  const roomContaining = (r: Rect) => Object.entries(layout).find(([, o]) => inside(r, o));

  const valid = (t: Target, r: Rect) => {
    if (t.kind === 'room') return canPlace(baseLayout, t.id, r);
    return r.w >= MIN_ITEM && r.d >= MIN_ITEM && !!roomContaining(r);
  };

  const commit = (t: Target, r: Rect) => {
    if (t.kind === 'room') return run((s, c) => setSpaceLayout(s, c, t.id, r));
    const hit = roomContaining(r);
    if (!hit) return false;
    const [rid, room] = hit;
    return run((s, c) => placeAsset(s, c, t.id, rid, { x: r.x - room.x, y: r.y - room.y, w: r.w, d: r.d }));
  };

  const startEdit = (t: Target, r?: Rect) => {
    const rect = r ?? rectOf(t);
    if (!rect) return;
    setTarget(t);
    setDraft(rect);
    navigator.vibrate?.(15);
  };
  const finishEdit = () => { setTarget(undefined); setDraft(undefined); frozenBox.current = null; };

  const onDown = (e: React.PointerEvent, kind: Kind, id: string) => {
    e.stopPropagation();
    if (target?.kind === kind && target.id === id) { beginDrag(e, 'move'); return; }
    if (target) { finishEdit(); return; }
    const editable = (kind === 'room' && layer === 'espacios') || (kind === 'item' && layer === 'muebles');
    const timer = editable ? window.setTimeout(() => {
      press.current = null;
      const r = rectOf({ kind, id });
      if (!r) return;
      startEdit({ kind, id }, r);
      // El encuadre puede cambiar al entrar en edición: el punto de partida se toma en el primer movimiento.
      drag.current = { mode: 'move', sx: NaN, sy: NaN, start: r };
    }, LONG_PRESS) : 0;
    press.current = { kind, id, x: e.clientX, y: e.clientY, timer };
  };

  const beginDrag = (e: React.PointerEvent, mode: Drag['mode']) => {
    e.stopPropagation();
    if (!target || !draft) return;
    svg.current?.setPointerCapture?.(e.pointerId);
    const p = toSvg(e.clientX, e.clientY);
    frozenBox.current = viewBox;
    drag.current = { mode, sx: p.x, sy: p.y, start: draft };
  };

  const onMove = (e: React.PointerEvent) => {
    const pr = press.current;
    if (pr && Math.hypot(e.clientX - pr.x, e.clientY - pr.y) > MOVE_TOL) { clearTimeout(pr.timer); press.current = null; }
    const d = drag.current;
    if (!d || !target) return;
    if (!frozenBox.current) frozenBox.current = viewBox;
    const p = toSvg(e.clientX, e.clientY);
    if (Number.isNaN(d.sx)) { d.sx = p.x; d.sy = p.y; return; }
    const step = target.kind === 'room' ? ROOM_STEP : STEP;
    const snap = (n: number) => Math.round(n / step) * step;
    const dx = p.x - d.sx, dy = p.y - d.sy;
    const gx = snap(((dx / U + dy / V) / 2) * 100), gy = snap(((dy / V - dx / U) / 2) * 100);
    const s = d.start;
    const cand: Rect = d.mode === 'move' ? { ...s, x: s.x + gx, y: s.y + gy }
      : d.mode === 'w' ? { ...s, w: s.w + gx } : { ...s, d: s.d + gy };
    if (valid(target, cand)) setDraft(cand);
  };

  const onUp = (kind?: Kind, id?: string) => {
    const pr = press.current;
    if (pr) {
      clearTimeout(pr.timer); press.current = null;
      if (kind && id && !target) (kind === 'room' ? onSelect : onOpenAsset)(id);
      return;
    }
    if (drag.current && target && draft) {
      drag.current = null;
      frozenBox.current = null;
      if (!commit(target, draft)) finishEdit();
    }
  };

  const nudge = (delta: Partial<Rect>) => {
    if (!target || !draft) return;
    const k = target.kind === 'room' ? ROOM_STEP : STEP;
    const cand = { x: draft.x + (delta.x ?? 0) * k, y: draft.y + (delta.y ?? 0) * k, w: draft.w + (delta.w ?? 0) * k, d: draft.d + (delta.d ?? 0) * k };
    if (!valid(target, cand)) {
      notify(target.kind === 'room' ? 'No entra: choca con otra habitación o se pasa del tamaño' : 'El mueble tiene que quedar dentro de una habitación');
      return;
    }
    setDraft(cand);
    commit(target, cand);
  };

  const placeNew = (a: Asset) => {
    const rid = roomOf(state, a.spaceId)!;
    const room = layout[rid];
    const spot = freeSpot(state, rid, room);
    if (run((s, c) => placeAsset(s, c, a.id, rid, spot))) startEdit({ kind: 'item', id: a.id }, { x: room.x + spot.x, y: room.y + spot.y, w: spot.w, d: spot.d });
  };

  const order = rooms.slice().sort((a, b) => (layout[a.id].x + layout[a.id].y) - (layout[b.id].x + layout[b.id].y));
  const itemOrder = items.slice().sort((a, b) => (a.rect.x + a.rect.w + a.rect.y + a.rect.d) - (b.rect.x + b.rect.w + b.rect.y + b.rect.d));
  const avRoom = rooms.find((r) => r.id === selected) ?? rooms[0];
  const av = layout[avRoom.id];
  const [avx, avy] = P(av.x + Math.min(100, av.w / 2), av.y + av.d / 2);
  const editAsset = target?.kind === 'item' ? state.assets.find((a) => a.id === target.id) : undefined;
  const editRoom = target?.kind === 'room' ? rooms.find((r) => r.id === target.id) : undefined;

  return (
    <>
      <svg ref={svg} className={`iso layer-${layer}${target ? ' editing' : ''}`} viewBox={viewBox} role="group"
        aria-label={layer === 'espacios' ? 'Plano de la casa: capa de espacios' : 'Plano de la casa: capa de muebles'}
        onPointerMove={onMove} onPointerUp={() => onUp()} onPointerCancel={() => onUp()}
        onPointerDown={() => { if (target) finishEdit(); }}
        onContextMenu={(e) => e.preventDefault()}>
        {target && <Grid layout={layout} step={target.kind === 'room' ? 100 : 50} />}
        {/* Paredes primero: los pisos de adelante tapan las internas y quedan solo las del contorno. */}
        {order.map((room) => {
          const r = layout[room.id];
          const A = P(r.x, r.y), B = P(r.x + r.w, r.y), D = P(r.x, r.y + r.d);
          return (
            <g key={`w${room.id}`} aria-hidden>
              <polygon points={pts(D, A, lift(A, WALL), lift(D, WALL))} className="wall-l" />
              <polygon points={pts(A, B, lift(B, WALL), lift(A, WALL))} className="wall-r" />
              {openings.filter((o) => o.spaceId === room.id && (o.side === 'n' || o.side === 'w')).map((o) => {
                const [x1, y1, x2, y2] = openingSegment(fitOpening(o, r), r);
                const sill = o.kind === 'puerta' ? 0 : Math.max(0, 210 - o.height);
                const lo = WALL * Math.min(1, sill / 260), hi = WALL * Math.min(0.95, (sill + o.height) / 260);
                const a = P(x1, y1), b = P(x2, y2);
                return <polygon key={o.id} points={pts(lift(a, lo), lift(b, lo), lift(b, hi), lift(a, hi))} className={o.kind === 'puerta' ? 'op-door' : 'op-window'} />;
              })}
            </g>
          );
        })}
        {order.map((room) => {
          const r = layout[room.id];
          const editing = target?.kind === 'room' && target.id === room.id;
          return (
            <g key={room.id} className={`room${room.id === selected ? ' sel' : ''}${editing ? ' edit' : ''}`}
              tabIndex={0} role="button" aria-label={`${room.name}, ${counts[room.id] ?? 0} objetos, ${r.w} por ${r.d} centímetros`}
              onPointerDown={(e) => onDown(e, 'room', room.id)} onPointerUp={(e) => { e.stopPropagation(); onUp('room', room.id); }}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(room.id)}>
              <polygon points={pts(P(r.x, r.y), P(r.x + r.w, r.y), P(r.x + r.w, r.y + r.d), P(r.x, r.y + r.d))} fill={COLORS[room.kind]} className="floor" />
            </g>
          );
        })}
        {order.map((room) => {
          const r = layout[room.id];
          const n = counts[room.id] ?? 0;
          if (layer === 'muebles') {
            const [bx, by] = P(r.x + 30, r.y + 30);
            return <text key={`l${room.id}`} x={bx} y={by + 4} textAnchor="middle" className="room-tag" aria-hidden>{room.name.slice(0, 12)}</text>;
          }
          const [cx, cy] = P(r.x + r.w / 2, r.y + r.d / 2);
          const maxChars = Math.max(4, Math.round(((r.w + r.d) / 100) * 2.3));
          const editing = target?.kind === 'room' && target.id === room.id;
          return (
            <g key={`l${room.id}`} className="labels" aria-hidden>
              <text x={cx} y={cy - 2} textAnchor="middle" className="room-icon">{SPACE_ICON[room.kind]}</text>
              <text x={cx} y={cy + 16} textAnchor="middle" className="room-name">{room.name.length > maxChars ? room.name.slice(0, maxChars - 1) + '…' : room.name}</text>
              {editing && <text x={cx} y={cy + 30} textAnchor="middle" className="room-dims">{cm(r)}</text>}
              {n > 0 && !editing && (
                <g transform={`translate(${cx + 24},${cy - 12})`}><circle r="10" className="count" /><text textAnchor="middle" dy="4" className="count-t">{n}</text></g>
              )}
            </g>
          );
        })}
        {openings.filter((o) => (o.side === 's' || o.side === 'e') && layout[o.spaceId]).map((o) => {
          const [x1, y1, x2, y2] = openingSegment(fitOpening(o, layout[o.spaceId]), layout[o.spaceId]);
          return <polyline key={o.id} points={pts(P(x1, y1), P(x2, y2))} className={`op-floor ${o.kind}`} aria-hidden />;
        })}
        {itemOrder.map(({ asset, rect: r }) => {
          const A = P(r.x, r.y), B = P(r.x + r.w, r.y), C = P(r.x + r.w, r.y + r.d), D = P(r.x, r.y + r.d);
          const editing = target?.kind === 'item' && target.id === asset.id;
          const [cx, cy] = P(r.x + r.w / 2, r.y + r.d / 2);
          return (
            <g key={asset.id} className={`item${editing ? ' edit' : ''}`} tabIndex={layer === 'muebles' ? 0 : -1} role="button"
              aria-label={`${asset.name}, ${r.w} por ${r.d} centímetros`}
              onPointerDown={(e) => onDown(e, 'item', asset.id)} onPointerUp={(e) => { e.stopPropagation(); onUp('item', asset.id); }}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpenAsset(asset.id)}>
              <polygon points={pts(D, C, lift(C, BOX), lift(D, BOX))} className="side-l" />
              <polygon points={pts(B, C, lift(C, BOX), lift(B, BOX))} className="side-r" />
              <polygon points={pts(lift(A, BOX), lift(B, BOX), lift(C, BOX), lift(D, BOX))} className="top" />
              {layer === 'muebles' && <text x={cx} y={cy - BOX + 4} textAnchor="middle" className="item-name">{asset.name.length > 10 ? asset.name.slice(0, 9) + '…' : asset.name}</text>}
            </g>
          );
        })}
        {target && draft && (() => {
          const r = draft;
          const [wx, wy] = P(r.x + r.w, r.y + r.d / 2);
          const [dx, dy] = P(r.x + r.w / 2, r.y + r.d);
          const lifted = target.kind === 'item' ? BOX / 2 : 0;
          return (
            <>
              <g className="handle" onPointerDown={(e) => beginDrag(e, 'w')} role="button" aria-label="Arrastrar para cambiar el ancho">
                <circle cx={wx} cy={wy - lifted} r="12" /><text x={wx} y={wy - lifted + 4} textAnchor="middle">↔</text>
              </g>
              <g className="handle" onPointerDown={(e) => beginDrag(e, 'd')} role="button" aria-label="Arrastrar para cambiar el largo">
                <circle cx={dx} cy={dy - lifted} r="12" /><text x={dx} y={dy - lifted + 4} textAnchor="middle">↕</text>
              </g>
            </>
          );
        })()}
        {!target && layer === 'espacios' && (
          <g className="avatar" style={{ transform: `translate(${avx}px, ${avy - 8}px)` }} aria-label={`Avatar de ${alias}`}>
            <ellipse cx="0" cy="18" rx="9" ry="3" className="shadow" />
            <rect x="-6" y="0" width="12" height="16" rx="5" className="body" />
            <circle cx="0" cy="-6" r="7" className="head" />
          </g>
        )}
      </svg>

      {target && draft ? (
        <div className="edit-bar" role="toolbar" aria-label="Editar en el plano">
          <strong>
            {editRoom ? `${SPACE_ICON[editRoom.kind]} ${editRoom.name}` : editAsset?.name} · {cm(draft)}
          </strong>
          <div className="edit-controls">
            <span>Ancho <button onClick={() => nudge({ w: -1 })} aria-label="Menos ancho">−</button><button onClick={() => nudge({ w: 1 })} aria-label="Más ancho">+</button></span>
            <span>Largo <button onClick={() => nudge({ d: -1 })} aria-label="Menos largo">−</button><button onClick={() => nudge({ d: 1 })} aria-label="Más largo">+</button></span>
            <span>Mover <button onClick={() => nudge({ x: -1 })} aria-label="Mover hacia atrás a la izquierda">↖</button><button onClick={() => nudge({ y: -1 })} aria-label="Mover hacia atrás a la derecha">↗</button><button onClick={() => nudge({ y: 1 })} aria-label="Mover hacia adelante a la izquierda">↙</button><button onClick={() => nudge({ x: 1 })} aria-label="Mover hacia adelante a la derecha">↘</button></span>
          </div>
          <div className="actions">
            <button className="btn primary" onClick={finishEdit}>Listo</button>
            {editAsset && <button className="btn ghost" onClick={() => { if (run((s, c) => unplaceAsset(s, c, editAsset.id))) { notify('Quitado del plano (sigue en el inventario)'); finishEdit(); } }}>Quitar del plano</button>}
          </div>
          {editAsset && <p className="fine">Arrastralo a otra habitación para mudarlo: queda registrado en su historial.</p>}
        </div>
      ) : layer === 'espacios' ? (
        <p className="fine center">Tocá una habitación para ver lo que hay. Mantenela apretada para moverla o cambiar su ancho y largo.</p>
      ) : (
        <div className="tray">
          <p className="fine">Tocá un mueble para ver su ficha. Mantenelo apretado para moverlo o cambiar su tamaño.</p>
          {unplaced.length > 0 ? (
            <>
              <strong className="tray-title">Sin ubicar en el plano</strong>
              <div className="chips">
                {unplaced.map((a) => {
                  const room = state.spaces.find((x) => x.id === roomOf(state, a.spaceId));
                  return <button key={a.id} onClick={() => placeNew(a)}>＋ {a.name} <small>{room?.name}</small></button>;
                })}
              </div>
            </>
          ) : !items.length && <p className="muted">Asigná objetos a una habitación desde el inventario para ubicarlos acá.</p>}
        </div>
      )}
    </>
  );
}

/** Grilla alrededor de la casa, visible solo mientras se edita (1 m para espacios, 50 cm para muebles). */
function Grid({ layout, step }: { layout: Record<string, Rect>; step: number }) {
  const rs = Object.values(layout);
  const m = step === 100 ? 300 : 0;
  const x0 = Math.max(0, Math.min(...rs.map((r) => r.x)) - m), y0 = Math.max(0, Math.min(...rs.map((r) => r.y)) - m);
  const x1 = Math.max(...rs.map((r) => r.x + r.w)) + m, y1 = Math.max(...rs.map((r) => r.y + r.d)) + m;
  const lines: string[] = [];
  for (let x = x0; x <= x1 + 1e-9; x += step) lines.push(pts(P(x, y0), P(x, y1)));
  for (let y = y0; y <= y1 + 1e-9; y += step) lines.push(pts(P(x0, y), P(x1, y)));
  return <g className="grid" aria-hidden>{lines.map((l, i) => <polyline key={i} points={l} />)}</g>;
}
