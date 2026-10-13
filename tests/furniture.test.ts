import { describe, expect, it } from 'vitest';
import { freeSpot, placeAsset, unplaceAsset, clampPlace } from '../src/domain/furniture';
import { addAsset, addSpace, moveAsset, setupHousehold } from '../src/domain/inventory';
import { setSpaceLayout } from '../src/domain/layout';
import { emptyState } from '../src/domain/types';
import { exportJSON, importJSON } from '../src/persistence/backup';
import { fakeClock } from './helpers';

const c = fakeClock();
function house() {
  let s = setupHousehold(emptyState(), c, { alias: 'V', homeName: 'Casa', tenure: 'propia' });
  s = addSpace(s, c, { name: 'Living', kind: 'living' });
  s = addSpace(s, c, { name: 'Pieza', kind: 'dormitorio' });
  s = setSpaceLayout(s, c, s.spaces[0].id, { x: 0, y: 0, w: 3, d: 4 });
  s = addAsset(s, c, { name: 'Sillón', kind: 'activo', groupId: 'equipamiento', subcategory: 'Mueble', templateId: 'generico', tenure: 'propio', origin: 'declarado', spaceId: s.spaces[0].id });
  return s;
}

describe('capa de muebles', () => {
  it('ubica un mueble dentro de su habitación', () => {
    let s = house();
    s = placeAsset(s, c, s.assets[0].id, s.spaces[0].id, { x: 1, y: 0.5, w: 2, d: 1 });
    expect(s.assets[0].place).toEqual({ x: 1, y: 0.5, w: 2, d: 1 });
    expect(s.events.at(-1)!.type).toBe('creado');
  });
  it('no deja que se salga de la habitación ni medidas raras', () => {
    const s = house();
    const [a, r] = [s.assets[0].id, s.spaces[0].id];
    expect(() => placeAsset(s, c, a, r, { x: 3, y: 0, w: 2, d: 1 })).toThrow('dentro');
    expect(() => placeAsset(s, c, a, r, { x: 0.3, y: 0, w: 1, d: 1 })).toThrow('0,5');
    expect(() => placeAsset(s, c, a, r, { x: 0, y: 0, w: 0, d: 1 })).toThrow();
  });
  it('arrastrarlo a otra habitación lo mueve y deja el evento', () => {
    let s = house();
    const pieza = s.spaces[1].id;
    s = placeAsset(s, c, s.assets[0].id, pieza, { x: 0, y: 0, w: 1, d: 1 });
    expect(s.assets[0].spaceId).toBe(pieza);
    expect(s.events.at(-1)).toMatchObject({ type: 'movido', detail: 'Living → Pieza' });
  });
  it('mover el objeto desde la ficha lo saca del plano; quitar del plano no lo borra', () => {
    let s = house();
    s = placeAsset(s, c, s.assets[0].id, s.spaces[0].id, { x: 0, y: 0, w: 1, d: 1 });
    expect(unplaceAsset(s, c, s.assets[0].id).assets).toHaveLength(1);
    s = moveAsset(s, c, s.assets[0].id, s.spaces[1].id);
    expect(s.assets[0].place).toBeUndefined();
  });
  it('busca lugar libre y recorta si la habitación se achica', () => {
    let s = house();
    s = placeAsset(s, c, s.assets[0].id, s.spaces[0].id, { x: 0, y: 0, w: 1, d: 1 });
    expect(freeSpot(s, s.spaces[0].id, { x: 0, y: 0, w: 3, d: 4 })).toEqual({ x: 1, y: 0, w: 1, d: 1 });
    expect(clampPlace({ x: 3, y: 2, w: 2, d: 2 }, { x: 0, y: 0, w: 3, d: 3 })).toEqual({ x: 1, y: 1, w: 2, d: 2 });
  });
  it('la ubicación sobrevive al respaldo', () => {
    let s = house();
    s = placeAsset(s, c, s.assets[0].id, s.spaces[0].id, { x: 1.5, y: 1, w: 1.5, d: 0.5 });
    expect(importJSON(exportJSON(s)).assets[0].place).toEqual({ x: 1.5, y: 1, w: 1.5, d: 0.5 });
  });
});
