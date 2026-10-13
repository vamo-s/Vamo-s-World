export const TZ = 'America/Argentina/Cordoba';

/** Fecha local AAAA-MM-DD en Córdoba para un instante dado. */
export function localDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ });
}

export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));

/** Días entre dos fechas AAAA-MM-DD (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}
