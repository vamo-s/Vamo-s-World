import type { Clock } from '../src/domain/inventory';

export function fakeClock(start = '2026-10-13T12:00:00.000Z'): Clock {
  let n = 0;
  let t = Date.parse(start);
  return { now: () => new Date((t += 1000)).toISOString(), id: () => `id-${++n}` };
}
