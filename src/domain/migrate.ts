import { SCHEMA_VERSION, defaultHolidays } from './types';

export class MigrationError extends Error {}

type Raw = Record<string, unknown>;

/** migrations[n] lleva datos de la versión n a n+1. Sirve para respaldos y para lo guardado en el dispositivo. */
const migrations: Record<number, (d: Raw) => Raw> = {
  1: (d) => ({ ...d, tasks: [], money: [], budgets: [], holidays: defaultHolidays(), xp: [] }),
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
