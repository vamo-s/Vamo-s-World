import { isDate } from './dates';
import { base, need, type Clock } from './inventory';
import type { AppState, MoneyEntry, MoneyType } from './types';

export const INCOME_CATEGORIES = ['Sueldo', 'Changas', 'Ventas', 'Regalos', 'Otros ingresos'];
export const EXPENSE_CATEGORIES = ['Alquiler', 'Servicios', 'Supermercado', 'Transporte', 'Hogar y mantenimiento', 'Salud', 'Ocio', 'Educación', 'Otros gastos'];

/** Todo el cálculo en centavos enteros para no arrastrar errores de coma flotante. */
const cents = (n: number) => Math.round(n * 100);

export type MoneyInput = { type: MoneyType; amount: number; date: string; category: string; note?: string; nature?: 'real' | 'simulado'; assetId?: string };

export function addMoney(s: AppState, c: Clock, i: MoneyInput): AppState {
  need(s.household, 'Primero creá el hogar');
  need(Number.isFinite(i.amount) && i.amount > 0, 'El monto tiene que ser mayor a 0');
  need(cents(i.amount) < 1e15, 'Monto demasiado grande');
  need(isDate(i.date), 'Fecha inválida');
  need(i.category.trim(), 'Falta la categoría');
  const e: MoneyEntry = {
    ...base(c), householdId: s.household!.id, type: i.type, amount: cents(i.amount) / 100, currency: 'ARS',
    date: i.date, category: i.category.trim(), note: i.note?.trim() || undefined, nature: i.nature ?? 'real', assetId: i.assetId || undefined,
  };
  return { ...s, money: [...s.money, e] };
}

export function archiveMoney(s: AppState, c: Clock, id: string): AppState {
  need(s.money.some((m) => m.id === id), 'Movimiento inexistente');
  return { ...s, money: s.money.map((m) => (m.id === id ? { ...m, archivedAt: c.now(), updatedAt: c.now() } : m)) };
}

export function setBudget(s: AppState, c: Clock, category: string, monthly: number): AppState {
  need(s.household, 'Primero creá el hogar');
  need(category.trim(), 'Falta la categoría');
  need(Number.isFinite(monthly) && monthly >= 0, 'Monto inválido');
  const cur = s.budgets.find((b) => b.category === category && !b.archivedAt);
  if (monthly === 0) return cur ? { ...s, budgets: s.budgets.map((b) => (b === cur ? { ...b, archivedAt: c.now() } : b)) } : s;
  if (cur) return { ...s, budgets: s.budgets.map((b) => (b === cur ? { ...b, monthly, updatedAt: c.now() } : b)) };
  return { ...s, budgets: [...s.budgets, { ...base(c), householdId: s.household!.id, category: category.trim(), monthly }] };
}

export interface MonthSummary {
  income: number; expense: number; balance: number;
  simIncome: number; simExpense: number; simBalance: number;
  byCategory: Record<string, number>;
}

/** Resumen de un mes (AAAA-MM). Lo simulado nunca se mezcla con lo real. */
export function monthSummary(s: AppState, month: string): MonthSummary {
  let inc = 0, exp = 0, sinc = 0, sexp = 0;
  const cat: Record<string, number> = {};
  for (const m of s.money) {
    if (m.archivedAt || !m.date.startsWith(month)) continue;
    const v = cents(m.amount);
    if (m.nature === 'simulado') { if (m.type === 'ingreso') sinc += v; else sexp += v; continue; }
    if (m.type === 'ingreso') inc += v;
    else { exp += v; cat[m.category] = (cat[m.category] ?? 0) + v; }
  }
  return {
    income: inc / 100, expense: exp / 100, balance: (inc - exp) / 100,
    simIncome: sinc / 100, simExpense: sexp / 100, simBalance: (sinc - sexp) / 100,
    byCategory: Object.fromEntries(Object.entries(cat).map(([k, v]) => [k, v / 100])),
  };
}

export const entriesOfMonth = (s: AppState, month: string) =>
  s.money.filter((m) => !m.archivedAt && m.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
