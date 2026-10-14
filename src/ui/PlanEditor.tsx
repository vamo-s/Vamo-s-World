import { useEffect, useMemo, useRef, useState } from 'react';
import { MIN_ITEM, clampPlace, placeAsset, roomOf, unplaceAsset } from '../domain/furniture';
import { addAsset, archiveSpace, updateAsset, updateSpace } from '../domain/inventory';
import { SPACE_KINDS } from '../domain/labels';
import { LIMITS, LOT, LOT_PRESETS, addRoomAt, canPlace, insideLot, lotOf, resolveLayout, setLot, setSketch, setSpaceLayout, type Lot } from '../domain/layout';
import {
  OPENING_LIMITS, SIDE_NAME, addOpening, fitOpening, liveOpenings, openingSegment, removeOpening, sideLength, updateOpening,
} from '../domain/openings';
import type { Asset, Opening, Rect, Side, Space, SpaceKind } from '../domain/types';
import { cloudEnabled } from '../cloud/cloud';
import { useStore } from '../state/store';
import { PlanFromPhoto } from './PlanFromPhoto';
import { ROOM_FILL as FILL, SPACE_ICON } from './common';

// Modo construcción: plano visto desde arriba, en centímetros reales.
// Herramientas: elegir/mover, dibujar habitación, puerta, ventana y mueble. Pan con un dedo
// sobre el fondo, zoom con dos dedos, la rueda o los botones.

type Tool = 'elegir' | 'habitacion' | 'puerta' | 'ventana' | 'mueble';
type Sel = { kind: 'room' | 'item' | 'opening' | 'lot'; id: string };
type View = { x: number; y: number; w: number };
type Gesture =
  | { type: 'pan'; px: number; py: number; v: View; tap: { x: number; y: number }; hit?: Sel }
  | { type: 'draw'; x0: number; y0: number }
  | { type: 'move'; sel: Sel; x0: number; y0: number; start: Rect | Opening; moved: boolean; px: number; py: number }
  | { type: 'resize'; sel: Sel; x0: number; y0: number; start: Rect }
  | { type: 'pinch'; d0: number; v: View; mx: number; my: number };

const TOOLS: { id: Tool; icon: string; label: string }[] = [
  { id: 'elegir', icon: '👆', label: 'Elegir' },
  { id: 'habitacion', icon: '✏️', label: 'Habitación' },
  { id: 'puerta', icon: '🚪', label: 'Puerta' },
  { id: 'ventana', icon: '🪟', label: 'Ventana' },
  { id: 'mueble', icon: '🛋️', label: 'Mueble' },
];
const HINT: Record<Tool, string> = {
  elegir: 'Tocá algo para elegirlo y arrastralo para moverlo. Arrastrá el fondo para desplazarte.',
  habitacion: 'Dibujá un rectángulo con el dedo. Después ajustás las medidas exactas en centímetros.',
  puerta: 'Tocá una pared para poner una puerta.',
  ventana: 'Tocá una pared para poner una ventana.',
  mueble: 'Tocá dentro de una habitación para crear un mueble a medida, o ubicá uno del inventario.',
};
const WALL = 12;
const TAP = 6;
const snap = (n: number, step: number) => Math.round(n / step) * step;
const inside = (r: Rect, o: Rect) => r.x >= o.x && r.y >= o.y && r.x + r.w <= o.x + o.w && r.y + r.d <= o.y + o.d;
const norm = (x0: number, y0: number, x1: number, y1: number): Rect =>
  ({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), d: Math.abs(y1 - y0) });
const m2 = (r: Rect) => ((r.w * r.d) / 10000).toLocaleString('es-AR', { maximumFractionDigits: 1 });

export function PlanEditor({ onClose, startWithPhoto = false }: { onClose: () => void; startWithPhoto?: boolean }) {
  const { state, run, notify, ask } = useStore();
  const svg = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<Tool>('elegir');
  const [sel, setSel] = useState<Sel>();
  const [draft, setDraft] = useState<{ sel: Sel; rect?: Rect; opening?: Opening }>();
  const [drawing, setDrawing] = useState<Rect>();
  const [newRoom, setNewRoom] = useState<Rect>();
  const [newItem, setNewItem] = useState<{ roomId: string; x: number; y: number }>();
  const [placing, setPlacing] = useState<string>();
  const [size, setSize] = useState({ w: 360, h: 480 });
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const rooms = state.spaces.filter((x) => !x.archivedAt && !x.parentId);
  const baseLayout = useMemo(() => resolveLayout(state.spaces.filter((x) => !x.archivedAt && !x.parentId)), [state.spaces]);
  const layout = { ...baseLayout };
  if (draft?.sel.kind === 'room' && draft.rect) layout[draft.sel.id] = draft.rect;

  const items: { asset: Asset; rect: Rect; roomId: string }[] = [];
  for (const a of state.assets) {
    if (a.archivedAt || !a.place) continue;
    const rid = roomOf(state, a.spaceId);
    const room = rid && layout[rid];
    if (!rid || !room) continue;
    const p = clampPlace(a.place, room);
    const rect = draft?.sel.kind === 'item' && draft.sel.id === a.id && draft.rect ? draft.rect : { x: room.x + p.x, y: room.y + p.y, w: p.w, d: p.d };
    items.push({ asset: a, rect, roomId: rid });
  }
  const openings = liveOpenings(state).map((o) => (draft?.sel.kind === 'opening' && draft.sel.id === o.id && draft.opening ? draft.opening : o));
  const baseLot = lotOf(state);
  const lot: Lot = draft?.sel.kind === 'lot' && draft.rect ? { w: draft.rect.w, d: draft.rect.d } : baseLot;
  const lotRect: Rect = { x: 0, y: 0, w: lot.w, d: lot.d };
  const unplaced = state.assets.filter((a) => !a.archivedAt && !a.place && a.templateId !== 'puerta' && roomOf(state, a.spaceId));

  // Encuadre inicial: todo el terreno con 1 m de margen.
  const fit = (): View => {
    const x0 = -100, y0 = -100, x1 = baseLot.w + 100, y1 = baseLot.d + 100;
    const aspect = size.h / size.w;
    const w = Math.max(x1 - x0, (y1 - y0) / aspect, 300);
    return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - (w * aspect) / 2, w };
  };
  const [view, setViewRaw] = useState<View>(fit);
  const [fromPhoto, setFromPhoto] = useState(startWithPhoto);
  const [refit, setRefit] = useState(0);
  useEffect(() => { if (refit) setView(fit()); }, [refit]); // eslint-disable-line react-hooks/exhaustive-deps
  // La cámara no se aleja del terreno: el centro queda dentro de él (con 2 m de margen) y no se puede alejar de más.
  const setView = (next: View | ((v: View) => View)) => setViewRaw((cur) => {
    const v = typeof next === 'function' ? next(cur) : next;
    const aspect = size.h / size.w;
    const w = Math.min(v.w, Math.max(lot.w + 400, (lot.d + 400) / aspect) * 1.2);
    const cx = Math.max(-200, Math.min(lot.w + 200, v.x + v.w / 2));
    const cy = Math.max(-200, Math.min(lot.d + 200, v.y + (v.w * aspect) / 2));
    return { w, x: cx - w / 2, y: cy - (w * aspect) / 2 };
  });
  const h = view.w * (size.h / size.w);
  const px = view.w / size.w; // cm por pixel de pantalla
  const font = Math.max(8, 13 * px);

  const zoomRef = useRef<(k: number, cx: number, cy: number) => void>(() => {});
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width) || 360, h = Math.round(e.contentRect.height) || 480;
      setSize((o) => (o.w === w && o.h === h ? o : { w, h }));
    });
    ro.observe(el);
    const wheel = (e: WheelEvent) => { e.preventDefault(); zoomRef.current(e.deltaY > 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener('wheel', wheel); };
  }, []);

  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);
  useEffect(() => { setPlacing(undefined); if (tool !== 'elegir') setSel(undefined); }, [tool]);

  const toCm = (cx: number, cy: number) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  function zoomAt(k: number, cx: number, cy: number) {
    const p = toCm(cx, cy);
    setView((v) => {
      const w = Math.min(LIMITS.area * 1.5, Math.max(80, v.w * k));
      const r = w / v.w;
      return { w, x: p.x - (p.x - v.x) * r, y: p.y - (p.y - v.y) * r };
    });
  }
  zoomRef.current = zoomAt;
  const zoomBtn = (k: number) => {
    const b = svg.current?.getBoundingClientRect();
    if (b) zoomAt(k, b.left + b.width / 2, b.top + b.height / 2);
  };

  const roomAt = (x: number, y: number) => Object.entries(layout).find(([, r]) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.d);

  /** Pared más cercana al punto (dentro de una tolerancia en pantalla). */
  const wallAt = (x: number, y: number) => {
    let best: { roomId: string; side: Side; along: number; dist: number } | undefined;
    for (const [roomId, r] of Object.entries(layout)) {
      const cands: [Side, number, number, number][] = [
        ['n', Math.abs(y - r.y), x - r.x, r.w], ['s', Math.abs(y - (r.y + r.d)), x - r.x, r.w],
        ['w', Math.abs(x - r.x), y - r.y, r.d], ['e', Math.abs(x - (r.x + r.w)), y - r.y, r.d],
      ];
      for (const [side, dist, along, len] of cands) {
        if (along < 0 || along > len) continue;
        if (!best || dist < best.dist) best = { roomId, side, along, dist };
      }
    }
    return best && best.dist <= Math.max(25, 22 * px) ? best : undefined;
  };

  const select = (s?: Sel) => { setSel(s); setDraft(undefined); };

  // ---- Gestos ----
  const onDown = (e: React.PointerEvent, hit?: Sel) => {
    e.stopPropagation();
    svg.current?.setPointerCapture?.(e.pointerId);
    // El primer dedo empieza un gesto nuevo: se descartan punteros que no avisaron que se levantaron.
    if (e.isPrimary) pointers.current.clear();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), v: view, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      setDraft(undefined); setDrawing(undefined);
      return;
    }
    const p = toCm(e.clientX, e.clientY);
    if (tool === 'habitacion') { gesture.current = { type: 'draw', x0: snap(p.x, 10), y0: snap(p.y, 10) }; return; }
    // Solo se arrastra lo que ya está elegido; si no, el dedo desplaza el plano y un toque elige.
    if (tool === 'elegir' && hit && hit.kind !== 'lot' && sel?.kind === hit.kind && sel.id === hit.id) {
      const start = hit.kind === 'room' ? layout[hit.id] : hit.kind === 'item' ? items.find((i) => i.asset.id === hit.id)?.rect : openings.find((o) => o.id === hit.id);
      if (start) gesture.current = { type: 'move', sel: hit, x0: p.x, y0: p.y, start, moved: false, px: e.clientX, py: e.clientY };
      return;
    }
    gesture.current = { type: 'pan', px: e.clientX, py: e.clientY, v: view, tap: p, hit };
  };

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!sel || sel.kind === 'opening') return;
    const start = sel.kind === 'lot' ? lotRect : sel.kind === 'room' ? layout[sel.id] : items.find((i) => i.asset.id === sel.id)?.rect;
    if (!start) return;
    svg.current?.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = toCm(e.clientX, e.clientY);
    gesture.current = { type: 'resize', sel, x0: p.x, y0: p.y, start };
  };

  const validLot = (r: Rect) => r.w >= LOT.min && r.d >= LOT.min && r.w <= LOT.max && r.d <= LOT.max && Object.values(baseLayout).every((o) => insideLot(o, r));
  const validRect = (s: Sel, r: Rect) => s.kind === 'lot' ? validLot(r) : s.kind === 'room' ? canPlace(baseLayout, s.id, r, baseLot)
    : r.w >= MIN_ITEM && r.d >= MIN_ITEM && Object.values(layout).some((o) => inside(r, o));

  const onMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.type === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const w = Math.min(LIMITS.area * 1.5, Math.max(80, g.v.w * (g.d0 / d)));
      const box = svg.current!.getBoundingClientRect();
      const fx = (g.mx - box.left) / box.width, fy = (g.my - box.top) / box.height;
      const ax = g.v.x + fx * g.v.w, ay = g.v.y + fy * g.v.w * (size.h / size.w);
      setView({ w, x: ax - fx * w, y: ay - fy * w * (size.h / size.w) });
      return;
    }
    if (g.type === 'pan') {
      const k = g.v.w / size.w;
      setView({ ...g.v, x: g.v.x - (e.clientX - g.px) * k, y: g.v.y - (e.clientY - g.py) * k });
      return;
    }
    const p = toCm(e.clientX, e.clientY);
    if (g.type === 'draw') { setDrawing(norm(g.x0, g.y0, snap(p.x, 10), snap(p.y, 10))); return; }
    if (g.type === 'move') {
      if (!g.moved && Math.hypot(e.clientX - g.px, e.clientY - g.py) < TAP) return;
      g.moved = true;
      const step = g.sel.kind === 'room' ? 10 : 5;
      const dx = snap(p.x - g.x0, step), dy = snap(p.y - g.y0, step);
      if (g.sel.kind === 'opening') {
        const o = g.start as Opening;
        const r = layout[o.spaceId];
        const along = o.side === 'n' || o.side === 's' ? dx : dy;
        const offset = Math.max(0, Math.min(sideLength(r, o.side) - o.width, o.offset + along));
        setDraft({ sel: g.sel, opening: { ...o, offset } });
        return;
      }
      const s = g.start as Rect;
      const cand = { ...s, x: s.x + dx, y: s.y + dy };
      if (validRect(g.sel, cand)) setDraft({ sel: g.sel, rect: cand });
      return;
    }
    if (g.type === 'resize') {
      const step = g.sel.kind === 'lot' ? LOT.step : g.sel.kind === 'room' ? 10 : 5;
      const s = g.start;
      const cand = { ...s, w: Math.max(step, s.w + snap(p.x - g.x0, step)), d: Math.max(step, s.d + snap(p.y - g.y0, step)) };
      if (validRect(g.sel, cand)) setDraft({ sel: g.sel, rect: cand });
    }
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.type === 'pinch') return;
    if (g.type === 'pan') {
      const tapped = Math.hypot(e.clientX - g.px, e.clientY - g.py) < TAP;
      if (tapped) { if (g.hit) select(g.hit); else tapAt(g.tap.x, g.tap.y); }
      return;
    }
    if (g.type === 'draw') {
      const r = drawing;
      setDrawing(undefined);
      if (!r || r.w < LIMITS.min || r.d < LIMITS.min) { if (r) notify(`Cada lado necesita al menos ${LIMITS.min} cm`); return; }
      if (!insideLot(r, baseLot)) { notify('Se sale del terreno: agrandalo tocando su borde'); return; }
      if (!canPlace(baseLayout, '', r)) { notify('Se superpone con otra habitación'); return; }
      setNewRoom(r);
      return;
    }
    if (g.type === 'move' && !g.moved) return;
    if (draft) commitDraft(draft);
  };

  const commitDraft = (d: NonNullable<typeof draft>) => {
    let ok = true;
    if (d.sel.kind === 'lot' && d.rect) ok = run((s, c) => setLot(s, c, { w: d.rect!.w, d: d.rect!.d }));
    if (d.sel.kind === 'room' && d.rect) ok = run((s, c) => setSpaceLayout(s, c, d.sel.id, d.rect!));
    if (d.sel.kind === 'item' && d.rect) {
      const hit = Object.entries(layout).find(([, o]) => inside(d.rect!, o));
      ok = !!hit && run((s, c) => placeAsset(s, c, d.sel.id, hit[0], { ...d.rect!, x: d.rect!.x - hit[1].x, y: d.rect!.y - hit[1].y }));
    }
    if (d.sel.kind === 'opening' && d.opening) ok = run((s, c) => updateOpening(s, c, d.sel.id, { offset: d.opening!.offset }));
    setDraft(undefined);
    return ok;
  };

  const tapAt = (x: number, y: number) => {
    if (tool === 'elegir') { select(undefined); return; }
    if (tool === 'puerta' || tool === 'ventana') {
      const w = wallAt(x, y);
      if (!w) { notify('Tocá justo sobre una pared'); return; }
      const L = OPENING_LIMITS[tool];
      const r = layout[w.roomId];
      const width = Math.min(L.w, sideLength(r, w.side));
      const offset = Math.max(0, Math.min(sideLength(r, w.side) - width, snap(w.along - width / 2, 5)));
      let id = '';
      if (run((s, c) => { const n = addOpening(s, c, { spaceId: w.roomId, kind: tool, side: w.side, offset, width, height: L.h }); id = n.openings.at(-1)!.id; return n; })) {
        notify(tool === 'puerta' ? 'Puerta agregada (también quedó en el inventario)' : 'Ventana agregada');
        setTool('elegir');
        setSel({ kind: 'opening', id });
      }
      return;
    }
    if (tool === 'mueble') {
      const hit = roomAt(x, y);
      if (!hit) { notify('Tocá dentro de una habitación'); return; }
      const [roomId, r] = hit;
      if (placing) {
        const a = state.assets.find((z) => z.id === placing);
        const w = Math.min(60, r.w), d = Math.min(60, r.d);
        const rel = { x: Math.max(0, Math.min(r.w - w, snap(x - r.x - w / 2, 5))), y: Math.max(0, Math.min(r.d - d, snap(y - r.y - d / 2, 5))), w, d };
        if (a && run((s, c) => placeAsset(s, c, a.id, roomId, rel))) { setPlacing(undefined); setTool('elegir'); setSel({ kind: 'item', id: a.id }); }
        return;
      }
      setNewItem({ roomId, x: x - r.x, y: y - r.y });
    }
  };

  // ---- Selección actual ----
  const selRoom = sel?.kind === 'room' ? rooms.find((r) => r.id === sel.id) : undefined;
  const selItem = sel?.kind === 'item' ? items.find((i) => i.asset.id === sel.id) : undefined;
  const selOpening = sel?.kind === 'opening' ? openings.find((o) => o.id === sel.id) : undefined;
  const selLot = sel?.kind === 'lot';
  const selRect = selLot ? lotRect : selRoom ? layout[selRoom.id] : selItem?.rect;
  useEffect(() => {
    if (sel && !selLot && !selRoom && !selItem && !selOpening) setSel(undefined);
  }, [sel, selLot, selRoom, selItem, selOpening]);

  const sketch = state.household?.sketch;
  const order = rooms.slice();

  return (
    <div className="plan-editor" role="dialog" aria-modal="true" aria-label="Modo construcción">
      <header className="plan-top">
        <button className="btn ghost" onClick={onClose}>← Listo</button>
        <strong>Modo construcción</strong>
        {cloudEnabled() && <button className="btn ai-btn" onClick={() => setFromPhoto(true)}>🤖 Desde foto</button>}
        <div className="zoom">
          <button className="icon-btn" onClick={() => zoomBtn(1 / 1.3)} aria-label="Acercar">＋</button>
          <button className="icon-btn" onClick={() => zoomBtn(1.3)} aria-label="Alejar">－</button>
          <button className="icon-btn" onClick={() => setView(fit())} aria-label="Ver toda la casa">⤢</button>
        </div>
      </header>

      <div className="plan-tools" role="toolbar" aria-label="Herramientas">
        {TOOLS.map((t) => (
          <button key={t.id} className={tool === t.id ? 'on' : ''} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
            <span aria-hidden>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div className="plan-wrap">
      <svg ref={svg} className={`plan tool-${tool}`} viewBox={`${view.x} ${view.y} ${view.w} ${h}`} preserveAspectRatio="xMidYMid meet"
        onPointerDown={(e) => onDown(e)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()} aria-label="Plano en centímetros">
        <defs>
          <pattern id="g10" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" className="g-minor" strokeWidth={px * 0.6} /></pattern>
          <pattern id="g100" width="100" height="100" patternUnits="userSpaceOnUse">
            {px < 1.2 && <rect width="100" height="100" fill="url(#g10)" />}
            <path d="M100 0H0V100" className="g-major" strokeWidth={px} />
          </pattern>
        </defs>
        <rect x={view.x} y={view.y} width={view.w} height={h} fill="url(#g100)" />
        {/* Terreno: afuera se oscurece; el borde se toca para cambiar su tamaño. */}
        <path d={`M${view.x - 10} ${view.y - 10}h${view.w + 20}v${h + 20}h${-view.w - 20}z M0 0v${lot.d}h${lot.w}v${-lot.d}z`} className="p-outside" fillRule="evenodd" />
        <g className={`p-lot${sel?.kind === 'lot' ? ' on' : ''}`} onPointerDown={(e) => onDown(e, tool === 'elegir' ? { kind: 'lot', id: 'lot' } : undefined)}>
          <rect x={0} y={0} width={lot.w} height={lot.d} className="p-lot-hit" strokeWidth={Math.max(24, 22 * px)} />
          <rect x={0} y={0} width={lot.w} height={lot.d} className="p-lot-line" strokeWidth={Math.max(2, 2 * px)} strokeDasharray={`${10 * px} ${6 * px}`} />
          <text x={4 * px} y={-8 * px} fontSize={font * 0.9} className="p-lot-label">🏗️ Terreno · {(lot.w / 100).toLocaleString('es-AR')} × {(lot.d / 100).toLocaleString('es-AR')} m</text>
        </g>
        {sketch && <image href={sketch.image} x={sketch.x} y={sketch.y} width={sketch.w} opacity={sketch.opacity} preserveAspectRatio="xMinYMin meet" style={{ pointerEvents: 'none' }} />}

        {order.map((room) => {
          const r = layout[room.id];
          const on = sel?.kind === 'room' && sel.id === room.id;
          return (
            <g key={room.id} className={`p-room${on ? ' on' : ''}`} onPointerDown={(e) => onDown(e, tool === 'elegir' ? { kind: 'room', id: room.id } : undefined)}>
              <rect x={r.x} y={r.y} width={r.w} height={r.d} fill={FILL[room.kind]} className="p-floor" />
              <rect x={r.x} y={r.y} width={r.w} height={r.d} className="p-wall" strokeWidth={WALL} />
            </g>
          );
        })}

        {openings.map((o) => {
          const r = layout[o.spaceId];
          if (!r) return null;
          const f = fitOpening(o, r);
          const [x1, y1, x2, y2] = openingSegment(f, r);
          const on = sel?.kind === 'opening' && sel.id === o.id;
          // Hoja y arco de apertura hacia adentro de la habitación.
          const inward = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }[o.side];
          const hingeAtEnd = o.hinge === 'fin';
          const [hx, hy] = hingeAtEnd ? [x2, y2] : [x1, y1];
          const [ox, oy] = hingeAtEnd ? [x1, y1] : [x2, y2];
          const lx = hx + inward[0] * f.width, ly = hy + inward[1] * f.width;
          const sweep = (o.side === 'n' || o.side === 'e') !== hingeAtEnd ? 1 : 0;
          return (
            <g key={o.id} className={`p-open ${o.kind}${on ? ' on' : ''}`} onPointerDown={(e) => onDown(e, tool === 'elegir' ? { kind: 'opening', id: o.id } : undefined)}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="p-gap" strokeWidth={WALL + 2} />
              {o.kind === 'puerta' ? (
                <>
                  <line x1={hx} y1={hy} x2={lx} y2={ly} className="p-leaf" strokeWidth={Math.max(3, 2 * px)} />
                  <path d={`M${lx} ${ly} A${f.width} ${f.width} 0 0 ${sweep} ${ox} ${oy}`} className="p-swing" strokeWidth={Math.max(1, px)} />
                </>
              ) : (
                <line x1={x1} y1={y1} x2={x2} y2={y2} className="p-glass" strokeWidth={4} />
              )}
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="p-hit" strokeWidth={Math.max(30, 26 * px)} />
            </g>
          );
        })}

        {order.map((room) => {
          const r = layout[room.id];
          // La letra se achica para entrar en habitaciones chicas; las medidas se ocultan si no entran.
          const fs = Math.min(font, r.w / Math.max(6, room.name.length + 3), r.d / 3);
          const dims = `${r.w} × ${r.d} cm · ${m2(r)} m²`;
          const showDims = fs * 0.8 * dims.length * 0.55 < r.w;
          return (
            <g key={`t${room.id}`} className="p-label" aria-hidden>
              <text x={r.x + r.w / 2} y={r.y + r.d / 2 - (showDims ? fs * 0.6 : -fs * 0.35)} fontSize={fs} textAnchor="middle">{SPACE_ICON[room.kind]} {room.name}</text>
              {showDims && <text x={r.x + r.w / 2} y={r.y + r.d / 2 + fs * 0.7} fontSize={fs * 0.8} textAnchor="middle" className="p-dim">{dims}</text>}
            </g>
          );
        })}

        {items.map(({ asset, rect: r }) => {
          const on = sel?.kind === 'item' && sel.id === asset.id;
          return (
            <g key={asset.id} className={`p-item${on ? ' on' : ''}`} onPointerDown={(e) => onDown(e, tool === 'elegir' ? { kind: 'item', id: asset.id } : undefined)}>
              <rect x={r.x} y={r.y} width={r.w} height={r.d} rx={Math.min(4, r.w / 4)} strokeWidth={Math.max(1, 1.5 * px)} />
              {r.w > 30 * px && <text x={r.x + r.w / 2} y={r.y + r.d / 2} fontSize={Math.min(font * 0.85, r.d * 0.45)} textAnchor="middle" dominantBaseline="middle">{asset.name.length > 14 ? asset.name.slice(0, 13) + '…' : asset.name}</text>}
            </g>
          );
        })}

        {selRect && <Dims r={selRect} px={px} font={font} />}
        {selRect && (
          <g className="p-handle" onPointerDown={startResize} role="button" aria-label="Arrastrar para cambiar ancho y largo">
            <circle cx={selRect.x + selRect.w} cy={selRect.y + selRect.d} r={14 * px} />
            <text x={selRect.x + selRect.w} y={selRect.y + selRect.d} fontSize={14 * px} textAnchor="middle" dominantBaseline="central">⤡</text>
          </g>
        )}
        {drawing && (
          <g className={`p-draw${canPlace(baseLayout, '', drawing, baseLot) && drawing.w >= LIMITS.min && drawing.d >= LIMITS.min ? '' : ' bad'}`}>
            <rect x={drawing.x} y={drawing.y} width={drawing.w} height={drawing.d} strokeWidth={WALL / 2} />
            <Dims r={drawing} px={px} font={font} />
          </g>
        )}
      </svg>

      <section className="plan-panel">
        {selLot ? (
          <LotInspector key={`${lot.w}x${lot.d}`} lot={lot} />
        ) : selRoom && selRect ? (
          <RoomInspector key={selRoom.id + selRect.x + selRect.y + selRect.w + selRect.d} room={selRoom} rect={selRect}
            onArchive={async () => {
              if (await ask(`¿Archivar ${selRoom.name}? Sus objetos quedan en el inventario, sin ubicación.`, 'Archivar')
                && run((s, c) => archiveSpace(s, c, selRoom.id))) { notify('Habitación archivada'); select(undefined); }
            }} />
        ) : selItem ? (
          <ItemInspector key={selItem.asset.id + selItem.rect.x + selItem.rect.y + selItem.rect.w + selItem.rect.d} asset={selItem.asset} rect={selItem.rect} roomRect={layout[selItem.roomId]} roomId={selItem.roomId}
            onRemove={() => { if (run((s, c) => unplaceAsset(s, c, selItem.asset.id))) { notify('Quitado del plano (sigue en el inventario)'); select(undefined); } }} />
        ) : selOpening ? (
          <OpeningInspector key={selOpening.id + selOpening.offset + selOpening.width + selOpening.height + selOpening.hinge} o={selOpening} room={rooms.find((r) => r.id === selOpening.spaceId)!} rect={layout[selOpening.spaceId]}
            onRemove={async () => {
              const door = selOpening.kind === 'puerta';
              if (await ask(door ? '¿Quitar la puerta? Su ficha se archiva en el inventario (se puede restaurar).' : '¿Quitar la ventana?', 'Quitar')
                && run((s, c) => removeOpening(s, c, selOpening.id))) select(undefined);
            }} />
        ) : tool === 'mueble' && unplaced.length > 0 ? (
          <>
            <p className="fine">{placing ? 'Ahora tocá dónde va dentro de su habitación.' : HINT.mueble}</p>
            <div className="chips">
              {unplaced.map((a) => (
                <button key={a.id} className={placing === a.id ? 'on' : ''} onClick={() => setPlacing(placing === a.id ? undefined : a.id)}>
                  {a.name} <small>{state.spaces.find((x) => x.id === roomOf(state, a.spaceId))?.name}</small>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="fine">{HINT[tool]}</p>
            {tool === 'habitacion' && cloudEnabled() && <button className="btn" onClick={() => setFromPhoto(true)}>🤖 Armar el plano con una foto</button>}
            {tool === 'habitacion' && <SketchControls />}
          </>
        )}
      </section>
      </div>

      {fromPhoto && <PlanFromPhoto onClose={() => setFromPhoto(false)} onDone={() => { setFromPhoto(false); select(undefined); setTool('elegir'); setRefit((n) => n + 1); }} />}
      {newRoom && <NewRoomSheet rect={newRoom} onDone={(id) => { setNewRoom(undefined); setTool('elegir'); if (id) setSel({ kind: 'room', id }); }} />}
      {newItem && <NewItemSheet at={newItem} roomRect={layout[newItem.roomId]} onDone={(id) => { setNewItem(undefined); setTool('elegir'); if (id) setSel({ kind: 'item', id }); }} />}
    </div>
  );
}

/** Cotas de un rectángulo: ancho arriba y largo a la izquierda. */
function Dims({ r, px, font }: { r: Rect; px: number; font: number }) {
  const o = 22 * px;
  return (
    <g className="p-dims" aria-hidden strokeWidth={px}>
      <line x1={r.x} y1={r.y - o} x2={r.x + r.w} y2={r.y - o} />
      <line x1={r.x} y1={r.y - o - 5 * px} x2={r.x} y2={r.y - o + 5 * px} />
      <line x1={r.x + r.w} y1={r.y - o - 5 * px} x2={r.x + r.w} y2={r.y - o + 5 * px} />
      <text x={r.x + r.w / 2} y={r.y - o - 4 * px} fontSize={font * 0.85} textAnchor="middle">{r.w} cm</text>
      <line x1={r.x - o} y1={r.y} x2={r.x - o} y2={r.y + r.d} />
      <line x1={r.x - o - 5 * px} y1={r.y} x2={r.x - o + 5 * px} y2={r.y} />
      <line x1={r.x - o - 5 * px} y1={r.y + r.d} x2={r.x - o + 5 * px} y2={r.y + r.d} />
      <text x={r.x - o - 4 * px} y={r.y + r.d / 2} fontSize={font * 0.85} textAnchor="middle" transform={`rotate(-90 ${r.x - o - 4 * px} ${r.y + r.d / 2})`}>{r.d} cm</text>
    </g>
  );
}

/** Campo numérico en cm que confirma al salir o con Enter. */
function Num({ label, value, onCommit, min, max }: { label: string; value: number; onCommit: (n: number) => void; min?: number; max?: number }) {
  const [v, setV] = useState(String(value));
  const commit = () => {
    const n = Number(v.replace(',', '.'));
    if (!Number.isFinite(n) || n === value) { setV(String(value)); return; }
    onCommit(Math.round(n));
  };
  return (
    <label className="num">
      <span>{label}</span>
      <input inputMode="numeric" value={v} min={min} max={max} onChange={(e) => setV(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      <small>cm</small>
    </label>
  );
}

function RoomInspector({ room, rect, onArchive }: { room: Space; rect: Rect; onArchive: () => void }) {
  const { run } = useStore();
  const set = (patch: Partial<Rect>) => run((s, c) => setSpaceLayout(s, c, room.id, { ...rect, ...patch }));
  return (
    <div className="inspector">
      <div className="ins-head">
        <input className="ins-name" defaultValue={room.name} aria-label="Nombre" maxLength={40}
          onBlur={(e) => e.target.value.trim() && e.target.value !== room.name && run((s, c) => updateSpace(s, c, room.id, { name: e.target.value }))} />
        <select value={room.kind} aria-label="Tipo" onChange={(e) => run((s, c) => updateSpace(s, c, room.id, { kind: e.target.value as SpaceKind }))}>
          {(Object.keys(SPACE_KINDS) as SpaceKind[]).map((k) => <option key={k} value={k}>{SPACE_KINDS[k]}</option>)}
        </select>
      </div>
      <div className="nums">
        <Num label="Ancho" value={rect.w} onCommit={(w) => set({ w })} />
        <Num label="Largo" value={rect.d} onCommit={(d) => set({ d })} />
        <Num label="X" value={rect.x} onCommit={(x) => set({ x })} />
        <Num label="Y" value={rect.y} onCommit={(y) => set({ y })} />
      </div>
      <div className="actions">
        <button className="btn" onClick={() => set({ w: rect.d, d: rect.w })}>↻ Girar</button>
        <button className="btn ghost" onClick={onArchive}>Archivar</button>
      </div>
      <p className="fine">Superficie {m2(rect)} m². Medidas declaradas por vos; para obra, medí en el lugar.</p>
    </div>
  );
}

function ItemInspector({ asset, rect, roomRect, roomId, onRemove }: { asset: Asset; rect: Rect; roomRect: Rect; roomId: string; onRemove: () => void }) {
  const { run } = useStore();
  const rel = { x: rect.x - roomRect.x, y: rect.y - roomRect.y, w: rect.w, d: rect.d };
  const set = (patch: Partial<Rect>) => run((s, c) => placeAsset(s, c, asset.id, roomId, { ...rel, ...patch }));
  return (
    <div className="inspector">
      <div className="ins-head">
        <input className="ins-name" defaultValue={asset.name} aria-label="Nombre" maxLength={60}
          onBlur={(e) => e.target.value.trim() && e.target.value !== asset.name && run((s, c) => updateAsset(s, c, asset.id, { name: e.target.value }))} />
      </div>
      <div className="nums">
        <Num label="Ancho" value={rel.w} onCommit={(w) => set({ w })} />
        <Num label="Largo" value={rel.d} onCommit={(d) => set({ d })} />
        <Num label="Desde la izq." value={rel.x} onCommit={(x) => set({ x })} />
        <Num label="Desde arriba" value={rel.y} onCommit={(y) => set({ y })} />
      </div>
      <div className="actions">
        <button className="btn" onClick={() => set({ w: rel.d, d: rel.w })}>↻ Girar 90°</button>
        <button className="btn ghost" onClick={onRemove}>Quitar del plano</button>
      </div>
    </div>
  );
}

function OpeningInspector({ o, room, rect, onRemove }: { o: Opening; room: Space; rect: Rect; onRemove: () => void }) {
  const { run } = useStore();
  const L = OPENING_LIMITS[o.kind];
  const set = (patch: Parameters<typeof updateOpening>[3]) => run((s, c) => updateOpening(s, c, o.id, patch));
  const len = sideLength(rect, o.side);
  return (
    <div className="inspector">
      <div className="ins-head"><strong>{o.kind === 'puerta' ? '🚪 Puerta' : '🪟 Ventana'} · {room.name}, pared de {SIDE_NAME[o.side]}</strong></div>
      <div className="nums">
        <Num label="Ancho" value={o.width} onCommit={(width) => set({ width })} />
        <Num label="Alto" value={o.height} onCommit={(height) => set({ height })} />
        <Num label="Desde la esquina" value={o.offset} onCommit={(offset) => set({ offset })} />
      </div>
      <div className="actions">
        <select value={o.side} aria-label="Pared" onChange={(e) => {
          const side = e.target.value as Side;
          set({ side, offset: Math.max(0, Math.min(o.offset, sideLength(rect, side) - o.width)) });
        }}>
          {(Object.keys(SIDE_NAME) as Side[]).map((k) => <option key={k} value={k}>Pared de {SIDE_NAME[k]}</option>)}
        </select>
        {o.kind === 'puerta' && <button className="btn" onClick={() => set({ hinge: o.hinge === 'fin' ? 'inicio' : 'fin' })}>⇄ Bisagras</button>}
        <button className="btn ghost" onClick={onRemove}>Quitar</button>
      </div>
      <p className="fine">Pared de {len} cm. Ancho entre {L.minW} y {L.maxW} cm, alto entre {L.minH} y {L.maxH} cm.{o.assetId ? ' Las medidas también se guardan en la ficha de la puerta.' : ''}</p>
    </div>
  );
}

function NewRoomSheet({ rect, onDone }: { rect: Rect; onDone: (id?: string) => void }) {
  const { run, notify } = useStore();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<SpaceKind>('dormitorio');
  const [w, setW] = useState(String(rect.w));
  const [d, setD] = useState(String(rect.d));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = { ...rect, w: Math.round(Number(w)), d: Math.round(Number(d)) };
    let id: string | undefined;
    if (run((s, c) => { const n = addRoomAt(s, c, { name, kind, rect: r }); id = n.spaces.at(-1)!.id; return n; })) {
      notify(`${name.trim()} agregada al plano`);
      onDone(id);
    }
  };
  return (
    <div className="sheet-backdrop" onClick={() => onDone()}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label="Nueva habitación" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head"><h2>Nueva habitación</h2><button className="icon-btn" onClick={() => onDone()} aria-label="Cerrar">✕</button></header>
        <form className="sheet-body form" onSubmit={submit}>
          <label className="field"><span>Nombre</span><input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoFocus placeholder="Ej: Pieza de Vamo" /></label>
          <div className="nums">
            <label className="num"><span>Ancho</span><input inputMode="numeric" value={w} onChange={(e) => setW(e.target.value)} /><small>cm</small></label>
            <label className="num"><span>Largo</span><input inputMode="numeric" value={d} onChange={(e) => setD(e.target.value)} /><small>cm</small></label>
          </div>
          <div className="kind-grid">
            {(Object.keys(SPACE_KINDS) as SpaceKind[]).map((k) => (
              <button type="button" key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)} aria-pressed={kind === k}>{SPACE_KINDS[k]}</button>
            ))}
          </div>
          <button className="btn primary" type="submit">Agregar al plano</button>
        </form>
      </section>
    </div>
  );
}

function NewItemSheet({ at, roomRect, onDone }: { at: { roomId: string; x: number; y: number }; roomRect: Rect; onDone: (id?: string) => void }) {
  const { run, notify, state } = useStore();
  const room = state.spaces.find((x) => x.id === at.roomId)!;
  const [name, setName] = useState('');
  const [w, setW] = useState('80');
  const [d, setD] = useState('60');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const W = Math.round(Number(w)), D = Math.round(Number(d));
    const x = Math.max(0, Math.min(roomRect.w - W, snap(at.x - W / 2, 5))), y = Math.max(0, Math.min(roomRect.d - D, snap(at.y - D / 2, 5)));
    let id: string | undefined;
    const ok = run((s, c) => {
      const n = addAsset(s, c, {
        name, kind: 'activo', groupId: 'equipamiento', subcategory: 'Mueble', templateId: 'generico',
        spaceId: at.roomId, tenure: 'propio', origin: 'declarado',
      });
      id = n.assets.at(-1)!.id;
      return placeAsset(n, c, id, at.roomId, { x, y, w: W, d: D });
    });
    if (ok) { notify(`${name.trim()} agregado al plano y al inventario`); onDone(id); }
  };
  return (
    <div className="sheet-backdrop" onClick={() => onDone()}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label="Nuevo mueble" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head"><h2>Mueble en {room.name}</h2><button className="icon-btn" onClick={() => onDone()} aria-label="Cerrar">✕</button></header>
        <form className="sheet-body form" onSubmit={submit}>
          <label className="field"><span>Nombre</span><input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoFocus placeholder="Ej: Cama de 2 plazas" /></label>
          <div className="nums">
            <label className="num"><span>Ancho</span><input inputMode="numeric" value={w} onChange={(e) => setW(e.target.value)} /><small>cm</small></label>
            <label className="num"><span>Largo</span><input inputMode="numeric" value={d} onChange={(e) => setD(e.target.value)} /><small>cm</small></label>
          </div>
          <p className="fine">Medilo con un metro: ancho de frente y largo hacia el fondo. Queda en el inventario como “Mueble”.</p>
          <button className="btn primary" type="submit">Agregar</button>
        </form>
      </section>
    </div>
  );
}

/** Foto del boceto como fondo para calcar. Se reduce antes de guardar. */
function SketchControls() {
  const { state, run, notify } = useStore();
  const sk = state.household?.sketch;
  const load = async (f?: File) => {
    if (!f) return;
    const img = await createImageBitmap(f).catch(() => null);
    if (!img) { notify('No se pudo leer la imagen'); return; }
    const k = Math.min(1, 1200 / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
    const image = cv.toDataURL('image/jpeg', 0.7);
    if (run((s, c) => setSketch(s, c, { image, x: 0, y: 0, w: 1000, opacity: 0.45 }))) notify('Boceto de fondo cargado: ajustá su ancho real y calcá encima');
  };
  return (
    <div className="sketch">
      <label className="btn">📷 {sk ? 'Cambiar boceto' : 'Usar foto de mi boceto'}
        <input type="file" accept="image/*" hidden onChange={(e) => load(e.target.files?.[0])} />
      </label>
      {sk && (
        <div className="nums">
          <Num label="Ancho real" value={sk.w} onCommit={(w) => run((s, c) => setSketch(s, c, { ...sk, w }))} />
          <Num label="X" value={sk.x} onCommit={(x) => run((s, c) => setSketch(s, c, { ...sk, x }))} />
          <Num label="Y" value={sk.y} onCommit={(y) => run((s, c) => setSketch(s, c, { ...sk, y }))} />
          <button className="btn ghost" onClick={() => run((s, c) => setSketch(s, c, undefined))}>Quitar boceto</button>
        </div>
      )}
    </div>
  );
}

function LotInspector({ lot }: { lot: Lot }) {
  const { run, notify } = useStore();
  const set = (l: Lot) => { if (run((s, c) => setLot(s, c, l))) notify(`Terreno de ${l.w / 100} × ${l.d / 100} m`); };
  return (
    <div className="inspector">
      <div className="ins-head"><strong>🏗️ Terreno</strong></div>
      <div className="chips">
        {LOT_PRESETS.map((p) => (
          <button key={p.name} className={p.lot.w === lot.w && p.lot.d === lot.d ? 'on' : ''} onClick={() => set(p.lot)}>
            {p.name} <small>{p.lot.w / 100} × {p.lot.d / 100} m</small>
          </button>
        ))}
      </div>
      <div className="nums">
        <Num label="Frente" value={lot.w} onCommit={(w) => set({ ...lot, w })} />
        <Num label="Fondo" value={lot.d} onCommit={(d) => set({ ...lot, d })} />
      </div>
      <p className="fine">Es el límite donde podés construir. Arrastrá la manija de la esquina o elegí un tamaño. No se puede achicar dejando habitaciones afuera.</p>
    </div>
  );
}
