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
  s = setSpaceLayout(s, c, s.spaces[0].id, { x: 0, y: 0, w: 300, d: 400 });
  s = addAsset(s, c, { name: 'Sillón', kind: 'activo', groupId: 'equipamiento', subcategory: 'Mueble', templateId: 'generico', tenure: 'propio', origin: 'declarado', spaceId: s.spaces[0].id });
  return s;
}

describe('capa de muebles', () => {
  it('ubica un mueble dentro de su habitación', () => {
    let s = house();
    s = placeAsset(s, c, s.assets[0].id, s.spaces[0].id, { x: 100, y: 50, w: 200, d: 100 });
    expect(s.assets[0].place).toEqual({ x: 100, y: 50, w: 200, d: 100 });
    expect(s.events.at(-1)!.type).toBe('creado');
  });
  it('no deja que se salga de la habitación ni medidas raras', () => {
    const s = house();
    const [a, r] = [s.assets[0].id, s.spaces[0].id];
    expect(() => placeAsset(s, c, a, r, { x: 300, y: 0, w: 200, d: 100 })).toThrow('dentro');
    expect(() => placeAsset(s, c, a, r, { x: 30.5, y: 0, w: 100, d: 100 })).toThrow('enteros');
    expect(() => placeAsset(s, c, a, r, { x: 0, y: 0, w: 0, d: 100 })).toThrow();
  });
  it('arrastrarlo a otra habitación lo mueve y deja el evento', () => {
    let s = house();
    const pieza = s.spaces[1].id;
    s = placeAsset(s, c, s.assets[0].id, pieza, { x: 0, y: 0, w: 100, d: 100 });
    expect(s.assets[0].spaceId).toBe(pieza);
    expect(s.events.at(-1)).toMatchObject({ type: 'movido', detail: 'Living → Pieza' });
  });
  it('mover el objeto desde la ficha lo saca del plano; quitar del plano no lo borra', () => {
    let s = house();
    s = placeAsset(s, c, s.assets[0].id, s.spaces[0].id, { x: 0, y: 0, w: 100, d: 100 });
    expect(unplaceAsset(s, c, s.assets[0].id).assets).toHaveLength(1);
    s = moveAsset(s, c, s.assets[0].id, s.spaces[1].id);
    expect(s.assets[0].place).toBeUndefined();
  });
  it('busca lugar libre y recorta si la habitación se achica', () => {
    let s = house();
    s = placeAsset(s, c, s.assets[0].id, s.spaces[0].id, { x: 0, y: 0, w: 100, d: 100 });
    expect(freeSpot(s, s.spaces[0].id, { x: 0, y: 0, w: 300, d: 400 })).toEqual({ x: 100, y: 0, w: 60, d: 60 });
    expect(clampPlace({ x: 300, y: 200, w: 200, d: 200 }, { x: 0, y: 0, w: 300, d: 300 })).toEqual({ x: 100, y: 100, w: 200, d: 200 });
  });
  it('la ubicación sobrevive al respaldo', () => {
    let s = house();
    s = placeAsset(s, c, s.assets[0].id, s.spaces[0].id, { x: 150, y: 100, w: 150, d: 50 });
    expect(importJSON(exportJSON(s)).assets[0].place).toEqual({ x: 150, y: 100, w: 150, d: 50 });
  });
});
