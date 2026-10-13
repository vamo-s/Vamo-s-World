import { isDate } from './dates';
import { base, need, type Clock } from './inventory';
import type { AppState, MaintenanceTask, Priority, TaskStatus } from './types';

export type TaskInput = {
  title: string; description?: string; assetId?: string; spaceId?: string;
  dueDate?: string; priority?: Priority; assignee?: string;
};

function check(s: AppState, i: Partial<TaskInput>) {
  if (i.title !== undefined) need(i.title.trim(), 'Falta el título');
  if (i.dueDate) need(isDate(i.dueDate), 'Fecha inválida');
  if (i.assetId) need(s.assets.some((a) => a.id === i.assetId), 'El objeto no existe');
  if (i.spaceId) need(s.spaces.some((x) => x.id === i.spaceId), 'El espacio no existe');
}

export function addTask(s: AppState, c: Clock, i: TaskInput): AppState {
  need(s.household, 'Primero creá el hogar');
  check(s, i);
  const t: MaintenanceTask = {
    ...base(c), householdId: s.household!.id, title: i.title.trim(), description: i.description || undefined,
    assetId: i.assetId || undefined, spaceId: i.spaceId || undefined, dueDate: i.dueDate || undefined,
    priority: i.priority ?? 'media', assignee: i.assignee || undefined, status: 'pendiente',
    log: [{ at: c.now(), text: 'Tarea creada' }],
  };
  return { ...s, tasks: [...s.tasks, t] };
}

export function updateTask(s: AppState, c: Clock, id: string, patch: Partial<TaskInput>): AppState {
  need(s.tasks.some((t) => t.id === id), 'Tarea inexistente');
  check(s, patch);
  return {
    ...s,
    tasks: s.tasks.map((t) => (t.id === id
      ? { ...t, ...patch, title: (patch.title ?? t.title).trim(), updatedAt: c.now(), log: [...t.log, { at: c.now(), text: 'Datos editados' }] }
      : t)),
  };
}

const STATUS_TEXT: Record<TaskStatus, string> = {
  pendiente: 'Volvió a pendiente', en_curso: 'En curso', hecha: 'Completada (declarado)', cancelada: 'Cancelada',
};

export function setTaskStatus(s: AppState, c: Clock, id: string, status: TaskStatus, evidence?: string): AppState {
  const cur = s.tasks.find((t) => t.id === id);
  need(cur, 'Tarea inexistente');
  if (cur!.status === status && !evidence) return s;
  const t = c.now();
  return {
    ...s,
    tasks: s.tasks.map((x) => (x.id === id ? {
      ...x, status, updatedAt: t,
      completedAt: status === 'hecha' ? t : undefined,
      evidence: evidence?.trim() || x.evidence,
      log: [...x.log, { at: t, text: STATUS_TEXT[status] + (evidence?.trim() ? ` · evidencia: ${evidence.trim()}` : '') }],
    } : x)),
  };
}

export function addTaskNote(s: AppState, c: Clock, id: string, text: string): AppState {
  need(text.trim(), 'Escribí la nota');
  need(s.tasks.some((t) => t.id === id), 'Tarea inexistente');
  return { ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, updatedAt: c.now(), log: [...t.log, { at: c.now(), text: text.trim() }] } : t)) };
}

const PRIO: Record<Priority, number> = { alta: 0, media: 1, baja: 2 };

/** Abiertas primero, por fecha (sin fecha al final) y prioridad. */
export function sortTasks(ts: MaintenanceTask[]): MaintenanceTask[] {
  const open = (t: MaintenanceTask) => (t.status === 'pendiente' || t.status === 'en_curso' ? 0 : 1);
  return ts.slice().sort((a, b) => open(a) - open(b) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || PRIO[a.priority] - PRIO[b.priority]);
}

export const openTasks = (s: AppState) => s.tasks.filter((t) => t.status === 'pendiente' || t.status === 'en_curso');
