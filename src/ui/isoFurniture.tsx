import type { Asset, Rect } from '../domain/types';

// Muebles isométricos estilo Habbo, dibujados con cajas (prismas) en SVG: sin imágenes,
// colores planos con contorno oscuro y tres tonos por caja, más acentos neón "futuristas".
// Todo en centímetros del plano; la proyección la pasa quien llama.

export type Proj = (x: number, y: number) => [number, number];
export type FurnitureKind =
  | 'cama' | 'sillon' | 'silla' | 'mesa' | 'escritorio' | 'heladera' | 'tele' | 'ropero'
  | 'planta' | 'lampara' | 'lavarropas' | 'cocina' | 'inodoro' | 'compu' | 'caja';

const RULES: [FurnitureKind, RegExp][] = [
  ['sillon', /sill[oó]n|sof[aá]|futon|puff/],
  ['cama', /\bcama|colch[oó]n|cucheta/],
  ['silla', /\bsilla|banqueta|taburete/],
  ['escritorio', /escritorio/],
  ['mesa', /\bmesa|mesada|isla/],
  ['heladera', /heladera|freezer|refrigerador/],
  ['tele', /\btele|\btv\b|televisor|smart ?tv|monitor|pantalla/],
  ['ropero', /ropero|placard|armario|biblioteca|estanter|rack|alacena|vajillero/],
  ['planta', /planta|maceta|cactus|helecho/],
  ['lampara', /l[aá]mpara|velador|luz|aplique/],
  ['lavarropas', /lavarropas|secarropas|lavavajillas/],
  ['cocina', /cocina|horno|anafe|microondas/],
  ['inodoro', /inodoro|\bwc\b|bidet/],
  ['compu', /compu|notebook|laptop|\bpc\b|consola|play ?station|xbox/],
];

export function furnitureKind(a: Pick<Asset, 'name' | 'subcategory'>): FurnitureKind {
  const t = `${a.name} ${a.subcategory}`.toLowerCase();
  return RULES.find(([, re]) => re.test(t))?.[0] ?? 'caja';
}

/** Paleta tipo Habbo: tono base, cara clara (arriba), media (izq.) y oscura (der.). */
type Tone = [top: string, left: string, right: string];
const T = {
  madera: ['#d9a066', '#b97f4a', '#8f5f34'],
  maderaOsc: ['#a56a3d', '#7f4f2c', '#5e3a20'],
  blanco: ['#f8f8f4', '#d9dbd6', '#b9bcb6'],
  gris: ['#a9b1bb', '#858d98', '#666d77'],
  negro: ['#4a4f5a', '#343842', '#23262e'],
  azul: ['#7aa7ff', '#567fd6', '#3c5fae'],
  rojo: ['#ff7b7b', '#d65656', '#a83d3d'],
  verde: ['#7ed37e', '#56ad56', '#3c843c'],
  maceta: ['#e08b5a', '#bb6a3f', '#934f2d'],
  pantalla: ['#7ff5ff', '#20c4e6', '#1596b3'],
} satisfies Record<string, Tone>;

interface Box { x: number; y: number; w: number; d: number; z: number; h: number; tone: Tone; glow?: boolean }

const H = 0.16; // px por cm de altura (un poco exagerado, como en Habbo)

function boxEls(b: Box, P: Proj, key: string) {
  const up = (p: [number, number], z: number): [number, number] => [p[0], p[1] - z * H];
  const A = P(b.x, b.y), B = P(b.x + b.w, b.y), C = P(b.x + b.w, b.y + b.d), D = P(b.x, b.y + b.d);
  const z0 = b.z, z1 = b.z + b.h;
  const pts = (...ps: [number, number][]) => ps.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <g key={key} className={b.glow ? 'fx-glow' : undefined}>
      <polygon points={pts(up(D, z0), up(C, z0), up(C, z1), up(D, z1))} fill={b.tone[1]} />
      <polygon points={pts(up(B, z0), up(C, z0), up(C, z1), up(B, z1))} fill={b.tone[2]} />
      <polygon points={pts(up(A, z1), up(B, z1), up(C, z1), up(D, z1))} fill={b.tone[0]} />
    </g>
  );
}

/** Piezas del mueble en coordenadas absolutas, de atrás hacia adelante. */
function parts(kind: FurnitureKind, r: Rect, accent: Tone): Box[] {
  const { x, y, w, d } = r;
  const wide = w >= d; // el respaldo/cabecera va sobre el lado largo de atrás
  const back = (t: number, z: number, h: number, tone: Tone): Box =>
    wide ? { x, y, w, d: Math.max(4, d * t), z, h, tone } : { x, y, w: Math.max(4, w * t), d, z, h, tone };
  const legs = (s: number, h: number, tone: Tone): Box[] => [
    { x, y, w: s, d: s, z: 0, h, tone }, { x: x + w - s, y, w: s, d: s, z: 0, h, tone },
    { x, y: y + d - s, w: s, d: s, z: 0, h, tone }, { x: x + w - s, y: y + d - s, w: s, d: s, z: 0, h, tone },
  ];
  const inset = (k: number, z: number, h: number, tone: Tone, glow?: boolean): Box =>
    ({ x: x + k, y: y + k, w: Math.max(2, w - 2 * k), d: Math.max(2, d - 2 * k), z, h, tone, glow });
  switch (kind) {
    case 'cama': {
      const head = back(0.22, 0, 75, T.maderaOsc);
      const foot: Box = wide ? { ...inset(4, 28, 14, T.blanco), y: y + d * 0.22, d: d * 0.78 - 4 } : { ...inset(4, 28, 14, T.blanco), x: x + w * 0.22, w: w * 0.78 - 4 };
      const blanket: Box = wide ? { ...foot, y: foot.y + foot.d * 0.35, d: foot.d * 0.65, z: 42, h: 3, tone: accent } : { ...foot, x: foot.x + foot.w * 0.35, w: foot.w * 0.65, z: 42, h: 3, tone: accent };
      const pillow: Box = wide ? { ...foot, x: x + w * 0.15, w: w * 0.7, d: Math.min(30, foot.d * 0.3), z: 42, h: 8, tone: T.blanco } : { ...foot, y: y + d * 0.15, d: d * 0.7, w: Math.min(30, foot.w * 0.3), z: 42, h: 8, tone: T.blanco };
      return [head, inset(0, 0, 28, T.madera), foot, pillow, blanket];
    }
    case 'sillon': {
      const arm = (first: boolean): Box => wide
        ? { x: first ? x : x + w - Math.max(6, w * 0.14), y, w: Math.max(6, w * 0.14), d, z: 0, h: 60, tone: accent }
        : { x, y: first ? y : y + d - Math.max(6, d * 0.14), w, d: Math.max(6, d * 0.14), z: 0, h: 60, tone: accent };
      return [back(0.28, 0, 85, accent), arm(true), inset(0, 0, 40, accent), arm(false)];
    }
    case 'silla':
      return [...legs(4, 45, T.negro).slice(0, 2), back(0.15, 45, 45, accent), ...legs(4, 45, T.negro).slice(2), inset(0, 45, 5, accent)];
    case 'mesa':
      // Tablero de madera con un filo de luz al frente.
      return [...legs(6, 72, T.maderaOsc), inset(0, 72, 4, T.madera),
        wide ? { x: x + 3, y: y + d - 2, w: w - 6, d: 1, z: 73, h: 2, tone: T.pantalla, glow: true } : { x: x + w - 2, y: y + 3, w: 1, d: d - 6, z: 73, h: 2, tone: T.pantalla, glow: true }];
    case 'escritorio': {
      const top = inset(0, 72, 4, T.blanco);
      const screen: Box = wide ? { x: x + w * 0.3, y: y + 2, w: w * 0.4, d: 3, z: 76, h: 35, tone: T.pantalla, glow: true } : { x: x + 2, y: y + d * 0.3, w: 3, d: d * 0.4, z: 76, h: 35, tone: T.pantalla, glow: true };
      return [...legs(5, 72, T.negro), top, screen];
    }
    case 'heladera':
      return [inset(0, 0, 180, T.blanco), { ...inset(0, 110, 1, T.gris) }, { x: x + w - 3, y: y + d - 3, w: 2, d: 2, z: 160, h: 4, tone: T.pantalla, glow: true }];
    case 'tele': {
      const stand = inset(0, 0, 50, T.negro);
      const scr: Box = wide ? { x: x + 4, y: y + d * 0.35, w: w - 8, d: 4, z: 50, h: 65, tone: T.pantalla, glow: true } : { x: x + w * 0.35, y: y + 4, w: 4, d: d - 8, z: 50, h: 65, tone: T.pantalla, glow: true };
      return [stand, scr];
    }
    case 'ropero':
      return [inset(0, 0, 200, T.madera), inset(-0.5, 200, 2, T.maderaOsc)];
    case 'planta': {
      const s = Math.min(w, d);
      const pot: Box = { x: x + (w - s * 0.6) / 2, y: y + (d - s * 0.6) / 2, w: s * 0.6, d: s * 0.6, z: 0, h: 35, tone: T.maceta };
      return [pot, { ...pot, x: pot.x - s * 0.12, y: pot.y - s * 0.12, w: pot.w + s * 0.24, d: pot.d + s * 0.24, z: 35, h: 45, tone: T.verde }];
    }
    case 'lampara': {
      const s = Math.min(w, d);
      const c = { x: x + w / 2, y: y + d / 2 };
      return [
        { x: c.x - s * 0.3, y: c.y - s * 0.3, w: s * 0.6, d: s * 0.6, z: 0, h: 4, tone: T.negro },
        { x: c.x - 2, y: c.y - 2, w: 4, d: 4, z: 4, h: 130, tone: T.negro },
        { x: c.x - s * 0.4, y: c.y - s * 0.4, w: s * 0.8, d: s * 0.8, z: 134, h: 25, tone: T.pantalla, glow: true },
      ];
    }
    case 'lavarropas':
      return [inset(0, 0, 85, T.blanco), { x: x + w * 0.3, y: y + d - 1, w: w * 0.4, d: 1, z: 25, h: 35, tone: T.pantalla, glow: true }];
    case 'cocina':
      return [inset(0, 0, 88, T.gris), inset(3, 88, 2, T.negro), { x: x + w * 0.2, y: y + d - 1, w: w * 0.6, d: 1, z: 20, h: 40, tone: T.negro }];
    case 'inodoro':
      return [back(0.3, 0, 75, T.blanco), inset(Math.min(w, d) * 0.12, 0, 40, T.blanco)];
    case 'compu':
      return [inset(0, 0, 4, T.negro), { ...back(0.12, 4, Math.min(30, Math.max(w, d) * 0.6), T.pantalla), glow: true }];
    default:
      return [inset(0, 0, 45, accent), inset(Math.min(w, d) * 0.15, 45, 1, T.pantalla, true)];
  }
}

const ACCENTS: Tone[] = [T.azul, T.rojo, T.verde, T.maderaOsc, T.gris];
const pick = (id: string) => ACCENTS[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % ACCENTS.length];

/** Altura total aproximada (para ubicar el nombre arriba del mueble). */
export function furnitureHeight(kind: FurnitureKind, r: Rect): number {
  return Math.max(...parts(kind, r, T.gris).map((b) => b.z + b.h)) * H;
}

export function FurnitureSprite({ asset, rect, P }: { asset: Asset; rect: Rect; P: Proj }) {
  const kind = furnitureKind(asset);
  const ps = parts(kind, rect, pick(asset.id))
    .map((b, i) => ({ b, i }))
    // Pintor: primero lo de atrás y abajo.
    .sort((m, n) => (m.b.x + m.b.y + m.b.w / 2 + m.b.d / 2) - (n.b.x + n.b.y + n.b.w / 2 + n.b.d / 2) || m.b.z - n.b.z || m.i - n.i);
  const A = P(rect.x, rect.y), B = P(rect.x + rect.w, rect.y), C = P(rect.x + rect.w, rect.y + rect.d), D = P(rect.x, rect.y + rect.d);
  return (
    <g className={`sprite k-${kind}`}>
      <polygon points={[A, B, C, D].map((p) => `${p[0] + 2},${p[1] + 1}`).join(' ')} className="fx-shadow" />
      {ps.map(({ b, i }) => boxEls(b, P, `b${i}`))}
    </g>
  );
}

/** Filtro neón compartido (uno solo por SVG). */
export function FurnitureDefs() {
  return (
    <defs>
      <filter id="neon" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.6" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
}
