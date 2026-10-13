import { SCHEMA_VERSION, defaultHolidays } from './types';

export class MigrationError extends Error {}

type Raw = Record<string, unknown>;

const toCm = (r: Raw) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 100) : v]));

/** migrations[n] lleva datos de la versión n a n+1. Sirve para respaldos y para lo guardado en el dispositivo. */
const migrations: Record<number, (d: Raw) => Raw> = {
  1: (d) => ({ ...d, tasks: [], money: [], budgets: [], holidays: defaultHolidays(), xp: [] }),
  // v3: el plano pasa de metros a centímetros; se suman puertas/ventanas y proyectos de mejora.
  2: (d) => ({
    ...d,
    spaces: (d.spaces as Raw[] ?? []).map((s) => (s.layout ? { ...s, layout: toCm(s.layout as Raw) } : s)),
    assets: (d.assets as Raw[] ?? []).map((a) => (a.place ? { ...a, place: toCm(a.place as Raw) } : a)),
    openings: [],
    projects: [],
  }),
};

export function migrate(data: Raw, from: number): Raw {
  let d = data;
  for (let v = from; v < SCHEMA_VERSION; v++) {
    const m = migrations[v];
    if (!m) throw new MigrationError(`No hay migración desde la versión ${v}`);
    d = m(d);
  }
  return { ...d, schemaVersion: SCHEMA_VERSION };
}
