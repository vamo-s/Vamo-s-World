import { DEMO_DOORS, DEMO_EXTRAS, FIT_TOL, type DemoDoor } from './catalog';
import { isDate } from './dates';
import { base, need, type Clock } from './inventory';
import { addTask } from './tasks';
import type { AppState, Asset, ImprovementProject } from './types';

// Proyecto de mejora "Cambiar una puerta". Todo el recorrido es DEMO: catálogo genérico,
// precios ilustrativos, sin compras ni pagos. Planificar crea una tarea con la fecha que elige el usuario.

const project = (s: AppState, id: string) => {
  const p = s.projects.find((x) => x.id === id);
  need(p, 'Proyecto inexistente');
  return p!;
};

export const doorAssets = (s: AppState): Asset[] => s.assets.filter((a) => !a.archivedAt && a.templateId === 'puerta');

export function startDoorProject(s: AppState, c: Clock, targetAssetId?: string): AppState {
  need(s.household, 'Primero creá el hogar');
  if (targetAssetId) need(doorAssets(s).some((a) => a.id === targetAssetId), 'Elegí una puerta del inventario');
  const p: ImprovementProject = {
    ...base(c), householdId: s.household!.id, kind: 'cambiar-puerta', title: 'Cambiar una puerta',
    status: 'borrador', targetAssetId, isDemo: true,
  };
  return { ...s, projects: [...s.projects, p] };
}

type Patch = Partial<Pick<ImprovementProject, 'targetAssetId' | 'productId' | 'install'>>;

export function updateProject(s: AppState, c: Clock, id: string, patch: Patch): AppState {
  const p = project(s, id);
  need(p.status === 'borrador', 'El proyecto ya está planificado');
  if (patch.targetAssetId) need(doorAssets(s).some((a) => a.id === patch.targetAssetId), 'Elegí una puerta del inventario');
  if (patch.productId) need(DEMO_DOORS.some((d) => d.id === patch.productId), 'Producto DEMO inexistente');
  if (patch.install) need(patch.install === 'profesional' || patch.install === 'propia', 'Instalación inválida');
  // Cambiar de puerta invalida el producto elegido.
  const reset = patch.targetAssetId && patch.targetAssetId !== p.targetAssetId ? { productId: undefined } : {};
  return { ...s, projects: s.projects.map((x) => (x.id === id ? { ...x, ...reset, ...patch, updatedAt: c.now() } : x)) };
}

export interface DoorFit {
  door: DemoDoor;
  fits: boolean;
  note: string;
}

/** Productos DEMO ordenados por cercanía a las medidas de la puerta; `fits` si entran en el vano. */
export function compatibleDoors(asset?: Asset): DoorFit[] {
  const w = Number(asset?.attributes.ancho), h = Number(asset?.attributes.alto);
  if (!w || !h) return DEMO_DOORS.map((door) => ({ door, fits: false, note: 'Cargá ancho y alto de tu puerta para comparar' }));
  return DEMO_DOORS.map((door) => {
    const dw = door.width - w, dh = door.height - h;
    const fits = Math.abs(dw) <= FIT_TOL.width && Math.abs(dh) <= FIT_TOL.height;
    const note = fits ? 'Mismas medidas que tu puerta'
      : `${dw > 0 ? '+' : ''}${dw} cm de ancho, ${dh > 0 ? '+' : ''}${dh} cm de alto: habría que adaptar el marco`;
    return { door, fits, note };
  }).sort((a, b) => Number(b.fits) - Number(a.fits) || Math.abs(a.door.width - w) - Math.abs(b.door.width - w) || a.door.price - b.door.price);
}

export interface Budget { lines: { label: string; amount: number }[]; total: number }

/** Presupuesto DEMO en pesos enteros. */
export function demoBudget(p: Pick<ImprovementProject, 'productId' | 'install'>): Budget {
  const door = DEMO_DOORS.find((d) => d.id === p.productId);
  const lines = [
    ...(door ? [{ label: door.name, amount: door.price }] : []),
    { label: 'Herrajes (bisagras, picaporte)', amount: DEMO_EXTRAS.herrajes },
    ...(p.install === 'profesional' ? [{ label: 'Colocación por profesional', amount: DEMO_EXTRAS.profesional }] : []),
  ];
  return { lines, total: lines.reduce((n, l) => n + l.amount, 0) };
}

/** Planificar: el usuario elige la fecha; se crea la tarea de mantenimiento vinculada. */
export function planProject(s: AppState, c: Clock, id: string, date: string): AppState {
  const p = project(s, id);
  need(p.status === 'borrador', 'El proyecto ya está planificado');
  need(p.targetAssetId && p.productId && p.install, 'Faltan pasos: puerta, modelo e instalación');
  need(isDate(date), 'Elegí una fecha');
  const door = DEMO_DOORS.find((d) => d.id === p.productId)!;
  const asset = s.assets.find((a) => a.id === p.targetAssetId);
  let next = addTask(s, c, {
    title: `Cambiar ${asset?.name ?? 'puerta'} (proyecto DEMO)`,
    description: `Modelo DEMO: ${door.name}. Instalación: ${p.install === 'profesional' ? 'profesional' : 'propia'}. Presupuesto ilustrativo, no es una compra.`,
    assetId: p.targetAssetId, spaceId: asset?.spaceId, dueDate: date, priority: 'media',
  });
  const taskId = next.tasks.at(-1)!.id;
  next = { ...next, projects: next.projects.map((x) => (x.id === id ? { ...x, status: 'planificado' as const, plannedDate: date, taskId, updatedAt: c.now() } : x)) };
  return next;
}

export function cancelProject(s: AppState, c: Clock, id: string): AppState {
  const p = project(s, id);
  need(p.status !== 'hecho', 'El proyecto ya está hecho');
  return { ...s, projects: s.projects.map((x) => (x.id === id ? { ...x, status: 'cancelado' as const, updatedAt: c.now() } : x)) };
}

/** Un proyecto planificado pasa a hecho cuando su tarea se completa. */
export const projectStatus = (s: AppState, p: ImprovementProject): ImprovementProject['status'] =>
  p.status === 'planificado' && s.tasks.find((t) => t.id === p.taskId)?.status === 'hecha' ? 'hecho' : p.status;
