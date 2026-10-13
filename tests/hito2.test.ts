import { describe, expect, it } from 'vitest';
import { addMoney, archiveMoney, monthSummary, setBudget } from '../src/domain/economy';
import { addAsset, addSpace, setupHousehold, updateAsset, type Clock } from '../src/domain/inventory';
import { migrate } from '../src/domain/migrate';
import { MISSIONS, addHoliday, claimHoliday, claimMission, holidayStatus, level, toggleHoliday, totalXP } from '../src/domain/progress';
import { addTask, addTaskNote, setTaskStatus, sortTasks } from '../src/domain/tasks';
import { emptyState, type AppState } from '../src/domain/types';
import { exportJSON, importJSON } from '../src/persistence/backup';
import { fakeClock } from './helpers';

const c = fakeClock();
const at = (iso: string): Clock => ({ now: () => iso, id: () => crypto.randomUUID() });
const home = () => setupHousehold(emptyState(), c, { alias: 'Vamo', homeName: 'Casa', tenure: 'alquilada' });

describe('mantenimiento', () => {
  it('crea y completa una tarea con evidencia y bitácora', () => {
    let s = addSpace(home(), c, { name: 'Lavadero', kind: 'lavadero' });
    s = addAsset(s, c, { name: 'Lavarropas', kind: 'activo', groupId: 'equipamiento', subcategory: 'Electrodoméstico', templateId: 'generico', tenure: 'propio', origin: 'declarado', spaceId: s.spaces[0].id });
    s = addTask(s, c, { title: 'Limpiar filtro', assetId: s.assets[0].id, dueDate: '2026-10-20', priority: 'alta', assignee: 'Vamo' });
    const id = s.tasks[0].id;
    s = setTaskStatus(s, c, id, 'en_curso');
    s = addTaskNote(s, c, id, 'Compré cepillo');
    s = setTaskStatus(s, c, id, 'hecha', 'Foto del filtro limpio');
    expect(s.tasks[0]).toMatchObject({ status: 'hecha', evidence: 'Foto del filtro limpio' });
    expect(s.tasks[0].completedAt).toBeTruthy();
    expect(s.tasks[0].log.map((l) => l.text)).toEqual(['Tarea creada', 'En curso', 'Compré cepillo', 'Completada (declarado) · evidencia: Foto del filtro limpio']);
  });
  it('no inventa fechas y valida las que se cargan', () => {
    const s = addTask(home(), c, { title: 'Revisar canilla' });
    expect(s.tasks[0].dueDate).toBeUndefined();
    expect(() => addTask(home(), c, { title: 'x', dueDate: '31/12' })).toThrow('Fecha');
  });
  it('ordena abiertas primero, por fecha y prioridad', () => {
    let s = home();
    s = addTask(s, c, { title: 'B', dueDate: '2026-11-01' });
    s = addTask(s, c, { title: 'A', dueDate: '2026-10-15', priority: 'baja' });
    s = addTask(s, c, { title: 'C' });
    s = setTaskStatus(s, c, s.tasks[0].id, 'hecha');
    expect(sortTasks(s.tasks).map((t) => t.title)).toEqual(['A', 'C', 'B']);
  });
});

describe('economía', () => {
  it('calcula el saldo real sin mezclar lo simulado ni flotantes', () => {
    let s = home();
    s = addMoney(s, c, { type: 'ingreso', amount: 1000.1, date: '2026-10-01', category: 'Sueldo' });
    s = addMoney(s, c, { type: 'gasto', amount: 0.2, date: '2026-10-02', category: 'Servicios' });
    s = addMoney(s, c, { type: 'gasto', amount: 300, date: '2026-10-03', category: 'Supermercado' });
    s = addMoney(s, c, { type: 'gasto', amount: 999, date: '2026-10-04', category: 'Ocio', nature: 'simulado' });
    s = addMoney(s, c, { type: 'gasto', amount: 50, date: '2026-09-30', category: 'Ocio' });
    const m = monthSummary(s, '2026-10');
    expect(m).toMatchObject({ income: 1000.1, expense: 300.2, balance: 699.9, simExpense: 999, simBalance: -999 });
    expect(m.byCategory).toEqual({ Servicios: 0.2, Supermercado: 300 });
    s = archiveMoney(s, c, s.money[2].id);
    expect(monthSummary(s, '2026-10').balance).toBe(999.9);
  });
  it('valida montos y fechas', () => {
    expect(() => addMoney(home(), c, { type: 'gasto', amount: -5, date: '2026-10-01', category: 'x' })).toThrow('mayor a 0');
    expect(() => addMoney(home(), c, { type: 'gasto', amount: 5, date: 'ayer', category: 'x' })).toThrow('Fecha');
  });
  it('crea, cambia y quita presupuestos', () => {
    let s = setBudget(home(), c, 'Supermercado', 100000);
    s = setBudget(s, c, 'Supermercado', 120000);
    expect(s.budgets.filter((b) => !b.archivedAt)).toHaveLength(1);
    expect(s.budgets[0].monthly).toBe(120000);
    s = setBudget(s, c, 'Supermercado', 0);
    expect(s.budgets.filter((b) => !b.archivedAt)).toHaveLength(0);
  });
});

describe('misiones y XP', () => {
  const five = (s: AppState) => {
    for (const n of ['a', 'b', 'c', 'd', 'e']) s = addAsset(s, c, { name: n, kind: 'activo', groupId: 'personales', subcategory: 'Libros', templateId: 'generico', tenure: 'propio', origin: 'declarado' });
    return s;
  };
  it('no se puede reclamar incompleta y se reclama una sola vez', () => {
    let s = home();
    expect(() => claimMission(s, c, 'registrar-5')).toThrow('no está completa');
    s = five(s);
    s = claimMission(s, c, 'registrar-5');
    expect(totalXP(s)).toBe(50);
    expect(() => claimMission(s, c, 'registrar-5')).toThrow('Ya reclamaste');
  });
  it('los objetos DEMO no cuentan y la misión de mejora queda bloqueada', () => {
    let s = home();
    for (const n of ['a', 'b', 'c', 'd', 'e']) s = addAsset(s, c, { name: n, kind: 'activo', groupId: 'personales', subcategory: 'Libros', templateId: 'generico', tenure: 'propio', origin: 'demo' });
    expect(MISSIONS[0].progress(s)).toEqual({ value: 0, goal: 5 });
    expect(MISSIONS.find((m) => m.id === 'planificar-mejora')!.progress(s)).toBeNull();
    expect(() => claimMission(s, c, 'planificar-mejora')).toThrow();
  });
  it('documentar habitación exige 3 objetos y una foto', () => {
    let s = addSpace(home(), c, { name: 'Pieza', kind: 'dormitorio' });
    for (const n of ['a', 'b', 'c']) s = addAsset(s, c, { name: n, kind: 'activo', groupId: 'personales', subcategory: 'Libros', templateId: 'generico', tenure: 'propio', origin: 'declarado', spaceId: s.spaces[0].id });
    expect(MISSIONS[2].progress(s)).toEqual({ value: 3, goal: 4 });
    s = updateAsset(s, c, s.assets[0].id, { photo: 'data:image/jpeg;base64,xx' });
    expect(claimMission(s, c, 'documentar-habitacion').xp).toHaveLength(1);
  });
  it('niveles cada 100 XP', () => {
    expect(level(0)).toEqual({ level: 1, into: 0, next: 100 });
    expect(level(250)).toEqual({ level: 3, into: 50, next: 100 });
  });
});

describe('festividades', () => {
  it('la DEMO se reclama hoy una sola vez, incluso tras recargar o reintentar', () => {
    let s = home();
    const now = at('2026-10-13T15:00:00Z');
    expect(holidayStatus(s, s.holidays[0], now.now())).toMatchObject({ eligible: true, date: '2026-10-13' });
    s = claimHoliday(s, now, 'demo');
    expect(() => claimHoliday(s, now, 'demo')).toThrow('Ya reclamaste');
    const back = importJSON(exportJSON(s));
    expect(() => claimHoliday(back, at('2026-10-14T15:00:00Z'), 'demo')).toThrow('Ya reclamaste');
    expect(s.xp[0]).toMatchObject({ key: 'fest:demo:2026', xp: 10, kind: 'festividad' });
  });
  it('usa la fecha de Córdoba: 01:00 UTC del 9/7 todavía es 8/7 en Argentina', () => {
    const s = home();
    expect(() => claimHoliday(s, at('2026-07-09T01:00:00Z'), 'independencia')).toThrow('Hoy no');
    expect(totalXP(claimHoliday(s, at('2026-07-09T04:00:00Z'), 'independencia'))).toBe(20);
  });
  it('respeta la ventana de reclamo y vuelve a habilitarse al año siguiente', () => {
    let s = home();
    expect(totalXP(claimHoliday(s, at('2026-07-12T15:00:00Z'), 'independencia'))).toBe(20);
    expect(() => claimHoliday(s, at('2026-07-13T15:00:00Z'), 'independencia')).toThrow('Hoy no');
    s = claimHoliday(s, at('2026-07-09T15:00:00Z'), 'independencia');
    s = claimHoliday(s, at('2027-07-09T15:00:00Z'), 'independencia');
    expect(s.xp.map((e) => e.key)).toEqual(['fest:independencia:2026', 'fest:independencia:2027']);
  });
  it('cruza el cambio de año: Navidad se puede reclamar hasta el 28/12 y Año Nuevo el 2/1', () => {
    const s = home();
    expect(holidayStatus(s, s.holidays.find((h) => h.id === 'anio-nuevo')!, '2027-01-02T15:00:00Z')).toMatchObject({ eligible: true, key: 'fest:anio-nuevo:2027' });
    expect(holidayStatus(s, s.holidays.find((h) => h.id === 'navidad')!, '2026-10-13T15:00:00Z')).toMatchObject({ eligible: false, date: '2026-12-25' });
  });
  it('desactivada no se reclama; las personalizadas funcionan', () => {
    let s = toggleHoliday(home(), 'demo', false);
    expect(() => claimHoliday(s, at('2026-10-13T15:00:00Z'), 'demo')).toThrow('desactivada');
    s = addHoliday(s, c, { name: 'Cumple de la casa', monthDay: '10-13', kind: 'juego' });
    const id = s.holidays.at(-1)!.id;
    expect(totalXP(claimHoliday(s, at('2026-10-13T15:00:00Z'), id))).toBe(10);
    expect(() => addHoliday(s, c, { name: 'x', monthDay: '13-40', kind: 'juego' })).toThrow();
  });
});

describe('migración v1 → v2', () => {
  it('un respaldo v1 se importa con las listas nuevas vacías y festividades por defecto', () => {
    const v1 = { app: 'vamos-house', schemaVersion: 1, data: { ...home(), schemaVersion: 1, tasks: undefined, money: undefined, budgets: undefined, holidays: undefined, xp: undefined } };
    const s = importJSON(JSON.stringify(v1));
    expect(s.schemaVersion).toBe(2);
    expect(s.tasks).toEqual([]);
    expect(s.holidays.some((h) => h.isDemo)).toBe(true);
    expect(s.household?.name).toBe('Casa');
  });
  it('rechaza XP duplicado en un respaldo manipulado', () => {
    let s = claimHoliday(home(), at('2026-10-13T15:00:00Z'), 'demo');
    s = { ...s, xp: [...s.xp, { ...s.xp[0], id: 'otro' }] };
    expect(() => importJSON(exportJSON(s))).toThrow('duplicadas');
  });
  it('migrate deja schemaVersion actual', () => {
    expect(migrate({ spaces: [] }, 1).schemaVersion).toBe(2);
  });
});
