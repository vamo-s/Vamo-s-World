import { daysBetween, localDate } from './dates';
import { need, type Clock } from './inventory';
import type { AppState, Holiday, HolidayKind } from './types';

// Misiones, XP y festividades. XP no tiene valor monetario ni se canjea.
// Toda recompensa lleva una clave idempotente: reclamar dos veces no suma dos veces.

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  xp: number;
  /** Progreso actual y meta; null = todavía no disponible en esta versión. */
  progress: (s: AppState) => { value: number; goal: number } | null;
  lockedNote?: string;
}

const live = <T extends { archivedAt?: string }>(xs: T[]) => xs.filter((x) => !x.archivedAt);

export const MISSIONS: MissionDef[] = [
  {
    id: 'registrar-5', title: 'Registrar 5 objetos', description: 'Cargá cinco cosas reales de tu casa (los ejemplos DEMO no cuentan).', xp: 50,
    progress: (s) => ({ value: Math.min(5, live(s.assets).filter((a) => a.origin !== 'demo').length), goal: 5 }),
  },
  {
    id: 'primer-mantenimiento', title: 'Completar un mantenimiento', description: 'Creá una tarea de mantenimiento y marcala como hecha.', xp: 40,
    progress: (s) => ({ value: s.tasks.some((t) => t.status === 'hecha') ? 1 : 0, goal: 1 }),
  },
  {
    id: 'documentar-habitacion', title: 'Documentar una habitación', description: 'Una habitación con al menos 3 objetos y 1 foto.', xp: 40,
    progress: (s) => {
      let best = 0;
      for (const sp of live(s.spaces)) {
        const as = live(s.assets).filter((a) => a.spaceId === sp.id);
        best = Math.max(best, Math.min(3, as.length) + (as.some((a) => a.photo) ? 1 : 0));
      }
      return { value: best, goal: 4 };
    },
  },
  {
    id: 'primer-presupuesto', title: 'Armar un presupuesto', description: 'Poné un límite mensual a una categoría de gastos.', xp: 30,
    progress: (s) => ({ value: live(s.budgets).length ? 1 : 0, goal: 1 }),
  },
  {
    id: 'primera-puerta', title: 'Poner una puerta en el plano', description: 'En el Modo construcción, tocá una pared con la herramienta Puerta.', xp: 20,
    progress: (s) => ({ value: s.openings.some((o) => !o.archivedAt && o.kind === 'puerta') ? 1 : 0, goal: 1 }),
  },
  {
    id: 'amueblar', title: 'Amueblar a medida', description: 'Ubicá 3 muebles reales en el plano con sus medidas.', xp: 30,
    progress: (s) => ({ value: Math.min(3, live(s.assets).filter((a) => a.place && a.origin !== 'demo').length), goal: 3 }),
  },
  {
    id: 'planificar-mejora', title: 'Planificar una mejora', description: 'Planificá el proyecto DEMO “Cambiar una puerta” con una fecha tuya.', xp: 50,
    progress: (s) => ({ value: s.projects.some((p) => p.status === 'planificado' || p.status === 'hecho') ? 1 : 0, goal: 1 }),
  },
];

export const totalXP = (s: AppState) => s.xp.reduce((n, e) => n + e.xp, 0);
export const hasKey = (s: AppState, key: string) => s.xp.some((e) => e.key === key);

export function level(xp: number) {
  return { level: 1 + Math.floor(xp / 100), into: xp % 100, next: 100 };
}

function grant(s: AppState, c: Clock, key: string, kind: 'mision' | 'festividad', reason: string, xp: number): AppState {
  if (hasKey(s, key)) return s;
  return { ...s, xp: [...s.xp, { id: c.id(), key, kind, reason, xp, at: c.now() }] };
}

export function claimMission(s: AppState, c: Clock, id: string): AppState {
  const m = MISSIONS.find((x) => x.id === id);
  need(m, 'Misión inexistente');
  const p = m!.progress(s);
  need(p && p.value >= p.goal, 'La misión todavía no está completa');
  need(!hasKey(s, `mision:${id}`), 'Ya reclamaste esta misión');
  return grant(s, c, `mision:${id}`, 'mision', `Misión: ${m!.title}`, m!.xp);
}

export interface HolidayStatus {
  holiday: Holiday;
  /** Fecha (AAAA-MM-DD) de la ocurrencia relevante: la reclamable, o la próxima. */
  date: string;
  eligible: boolean;
  claimed: boolean;
  key: string;
}

/** Estado de una festividad para la fecha local de Córdoba de `nowIso`. */
export function holidayStatus(s: AppState, h: Holiday, nowIso: string): HolidayStatus {
  const today = localDate(nowIso);
  const year = Number(today.slice(0, 4));
  const mk = (date: string) => {
    const key = `fest:${h.id}:${date.slice(0, 4)}`;
    const d = daysBetween(date, today);
    const inWindow = d >= 0 && d <= h.claimWindowDays;
    return { holiday: h, date, key, claimed: hasKey(s, key), eligible: h.active && inWindow && !hasKey(s, key), inWindow };
  };
  if (h.alwaysToday) { const { inWindow: _, ...r } = mk(today); return r; }
  // Ocurrencia de este año o la del año anterior si su ventana sigue abierta (ej. 31/12 reclamado el 2/1).
  for (const y of [year - 1, year]) {
    const r = mk(`${y}-${h.monthDay}`);
    if (r.inWindow) { const { inWindow: _, ...rest } = r; return rest; }
  }
  const thisYear = `${year}-${h.monthDay}`;
  const { inWindow: _, ...next } = mk(daysBetween(thisYear, today) > 0 ? `${year + 1}-${h.monthDay}` : thisYear);
  return next;
}

export function claimHoliday(s: AppState, c: Clock, id: string): AppState {
  const h = s.holidays.find((x) => x.id === id);
  need(h, 'Festividad inexistente');
  const st = holidayStatus(s, h!, c.now());
  need(!st.claimed, 'Ya reclamaste esta festividad este año');
  need(h!.active, 'La festividad está desactivada');
  need(st.eligible, 'Hoy no se puede reclamar esta festividad');
  return grant(s, c, st.key, 'festividad', `Festividad: ${h!.name}${h!.isDemo ? ' (DEMO)' : ''}`, h!.xp);
}

export function toggleHoliday(s: AppState, id: string, active: boolean): AppState {
  need(s.holidays.some((h) => h.id === id), 'Festividad inexistente');
  return { ...s, holidays: s.holidays.map((h) => (h.id === id ? { ...h, active } : h)) };
}

export function addHoliday(s: AppState, c: Clock, i: { name: string; monthDay: string; kind: HolidayKind }): AppState {
  need(i.name.trim(), 'Falta el nombre');
  need(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(i.monthDay), 'Fecha inválida (MM-DD)');
  const h: Holiday = {
    id: c.id(), name: i.name.trim(), monthDay: i.monthDay, kind: i.kind, region: 'Personalizada',
    source: 'Agregada por el jugador', active: true, xp: 10, claimWindowDays: 3, isDemo: false, custom: true,
  };
  return { ...s, holidays: [...s.holidays, h] };
}

/** Próximas festividades activas, ordenadas por fecha. */
export function upcoming(s: AppState, nowIso: string): HolidayStatus[] {
  return s.holidays.map((h) => holidayStatus(s, h, nowIso))
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.date.localeCompare(b.date));
}
