import { describe, expect, it } from 'vitest';
import { addSpace, archiveSpace, setupHousehold } from '../src/domain/inventory';
import { canPlace, resolveLayout, setSpaceLayout } from '../src/domain/layout';
import { emptyState } from '../src/domain/types';
import { exportJSON, importJSON } from '../src/persistence/backup';
import { fakeClock } from './helpers';

const c = fakeClock();
function house(n = 3) {
  let s = setupHousehold(emptyState(), c, { alias: 'V', homeName: 'Casa', tenure: 'propia' });
  for (let i = 0; i < n; i++) s = addSpace(s, c, { name: `H${i}`, kind: 'otro' });
  return s;
}

describe('plano de la casa', () => {
  it('ubica automáticamente sin superposición', () => {
    const s = house(5);
    const l = Object.values(resolveLayout(s.spaces));
    expect(l).toHaveLength(5);
    expect(l[0]).toEqual({ x: 0, y: 0, w: 300, d: 300 });
    expect(l[1]).toEqual({ x: 300, y: 0, w: 300, d: 300 });
    expect(l[3]).toEqual({ x: 0, y: 300, w: 300, d: 300 });
  });
  it('cambia ancho y largo y fija las demás para que no salten', () => {
    let s = house(3);
    const [a, b, d] = s.spaces.map((x) => x.id);
    s = setSpaceLayout(s, c, d, { x: 0, y: 300, w: 600, d: 400 });
    expect(s.spaces.find((x) => x.id === d)!.layout).toEqual({ x: 0, y: 300, w: 600, d: 400 });
    expect(s.spaces.find((x) => x.id === a)!.layout).toEqual({ x: 0, y: 0, w: 300, d: 300 });
    expect(s.spaces.find((x) => x.id === b)!.layout).toEqual({ x: 300, y: 0, w: 300, d: 300 });
  });
  it('no deja superponer ni salir de rango', () => {
    const s = house(2);
    const [a, b] = s.spaces.map((x) => x.id);
    expect(() => setSpaceLayout(s, c, a, { x: 0, y: 0, w: 400, d: 300 })).toThrow('Se superpone');
    expect(() => setSpaceLayout(s, c, a, { x: 0, y: 0, w: 0, d: 300 })).toThrow('fuera de rango');
    expect(() => setSpaceLayout(s, c, a, { x: 0, y: 0, w: 3100, d: 300 })).toThrow('fuera de rango');
    expect(() => setSpaceLayout(s, c, a, { x: 5.5, y: 0, w: 200, d: 300 })).toThrow('fuera de rango');
    expect(canPlace(resolveLayout(s.spaces), b, { x: 300, y: 0, w: 500, d: 200 })).toBe(true);
  });
  it('una habitación archivada libera su lugar', () => {
    let s = house(2);
    const [a, b] = s.spaces.map((x) => x.id);
    s = archiveSpace(s, c, b);
    expect(setSpaceLayout(s, c, a, { x: 0, y: 0, w: 600, d: 300 }).spaces[0].layout!.w).toBe(600);
  });
  it('la forma sobrevive al respaldo', () => {
    let s = house(1);
    s = setSpaceLayout(s, c, s.spaces[0].id, { x: 200, y: 100, w: 500, d: 400 });
    expect(importJSON(exportJSON(s)).spaces[0].layout).toEqual({ x: 200, y: 100, w: 500, d: 400 });
  });
});
