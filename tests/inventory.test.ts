import { describe, expect, it } from 'vitest';
import { validateAttributes } from '../src/domain/attributes';
import { seedDemo } from '../src/domain/demo';
import {
  addAsset, addSpace, archiveAsset, archiveSpace, filterAssets, moveAsset, setupHousehold, updateAsset, updateSpace,
  type AssetInput,
} from '../src/domain/inventory';
import { emptyState } from '../src/domain/types';
import { fakeClock } from './helpers';

const c = fakeClock();
const quick = (name: string, extra: Partial<AssetInput> = {}): AssetInput => ({
  name, kind: 'activo', groupId: 'equipamiento', subcategory: 'Herramienta', templateId: 'generico',
  tenure: 'propio', origin: 'declarado', ...extra,
});

function home() {
  let s = setupHousehold(emptyState(), c, { alias: 'Vamo', homeName: 'Depto Centro', tenure: 'alquilada' });
  s = addSpace(s, c, { name: 'Cocina', kind: 'cocina' });
  s = addSpace(s, c, { name: 'Dormitorio', kind: 'dormitorio' });
  return s;
}

describe('hogar y espacios', () => {
  it('crea hogar alquilado y habitaciones', () => {
    const s = home();
    expect(s.household?.tenure).toBe('alquilada');
    expect(s.spaces.map((x) => x.name)).toEqual(['Cocina', 'Dormitorio']);
  });
  it('exige hogar y nombre', () => {
    expect(() => addSpace(emptyState(), c, { name: 'X', kind: 'otro' })).toThrow('hogar');
    expect(() => setupHousehold(emptyState(), c, { alias: ' ', homeName: 'a', tenure: 'propia' })).toThrow();
  });
  it('edita y archiva espacio dejando sus objetos sin ubicación', () => {
    let s = home();
    const cocina = s.spaces[0].id;
    s = updateSpace(s, c, cocina, { name: 'Cocina comedor' });
    s = addAsset(s, c, quick('Pava', { spaceId: cocina }));
    s = archiveSpace(s, c, cocina);
    expect(s.spaces[0].archivedAt).toBeTruthy();
    expect(s.assets[0].spaceId).toBeUndefined();
    expect(s.events.at(-1)?.type).toBe('movido');
  });
});

describe('inventario universal', () => {
  it('registra rápido solo con nombre y categoría', () => {
    const s = addAsset(home(), c, quick('Taladro'));
    expect(s.assets[0]).toMatchObject({ name: 'Taladro', attributes: {} });
    expect(s.events[0].type).toBe('creado');
  });
  it('registra 5 objetos y filtra por texto, grupo y espacio', () => {
    let s = home();
    const [cocina, dorm] = s.spaces.map((x) => x.id);
    s = addAsset(s, c, quick('Pava eléctrica', { spaceId: cocina, groupId: 'equipamiento', subcategory: 'Electrodoméstico' }));
    s = addAsset(s, c, quick('Arroz', { spaceId: cocina, groupId: 'consumibles', subcategory: 'Alimentos', templateId: 'alimento', kind: 'consumible', quantity: 2, unit: 'kg' }));
    s = addAsset(s, c, quick('Campera', { spaceId: dorm, groupId: 'personales', subcategory: 'Ropa', templateId: 'prenda', attributes: { talle: 'L' } }));
    s = addAsset(s, c, quick('Notebook', { spaceId: dorm, templateId: 'computadora', attributes: { ram: '16' } }));
    s = addAsset(s, c, quick('Puerta', { groupId: 'vivienda', subcategory: 'Puerta', templateId: 'puerta', tenure: 'del_inmueble', attributes: { alto: '200', ancho: '70,5' } }));
    expect(filterAssets(s, {})).toHaveLength(5);
    expect(filterAssets(s, { spaceId: cocina }).map((a) => a.name)).toEqual(['Arroz', 'Pava eléctrica']);
    expect(filterAssets(s, { groupId: 'personales' })).toHaveLength(1);
    expect(filterAssets(s, { text: 'note' })[0].attributes).toEqual({ ram: 16 });
    expect(filterAssets(s, { spaceId: 'none' })[0].attributes).toEqual({ alto: 200, ancho: 70.5 });
  });
  it('mueve un objeto entre habitaciones y deja evento', () => {
    let s = home();
    const [cocina, dorm] = s.spaces.map((x) => x.id);
    s = addAsset(s, c, quick('Silla', { spaceId: cocina }));
    s = moveAsset(s, c, s.assets[0].id, dorm);
    expect(s.assets[0].spaceId).toBe(dorm);
    expect(s.events.at(-1)).toMatchObject({ type: 'movido', detail: 'Cocina → Dormitorio', origin: 'declarado' });
  });
  it('edita estado y tenencia con eventos separados', () => {
    let s = addAsset(home(), c, quick('Escalera'));
    s = updateAsset(s, c, s.assets[0].id, { condition: 'regular', tenure: 'prestado', custodian: 'Tío' });
    expect(s.events.slice(-2).map((e) => e.type)).toEqual(['estado', 'tenencia']);
  });
  it('archiva y restaura sin borrar', () => {
    let s = addAsset(home(), c, quick('Mesa'));
    s = archiveAsset(s, c, s.assets[0].id);
    expect(filterAssets(s, {})).toHaveLength(0);
    expect(filterAssets(s, { includeArchived: true })).toHaveLength(1);
    s = archiveAsset(s, c, s.assets[0].id, false);
    expect(filterAssets(s, {})).toHaveLength(1);
  });
  it('rechaza atributos inválidos y descarta claves desconocidas', () => {
    expect(() => addAsset(home(), c, quick('P', { templateId: 'puerta', attributes: { alto: 'mucho' } }))).toThrow('alto');
    expect(validateAttributes('puerta', { material: 'Plutonio' }).ok).toBe(false);
    expect(validateAttributes('prenda', { talle: 'M', hack: '<script>' }).values).toEqual({ talle: 'M' });
    expect(validateAttributes('alimento', { vencimiento: '13/10/2026' }).ok).toBe(false);
  });
  it('los datos demo quedan marcados como demo', () => {
    const s = seedDemo(emptyState(), c, 'Vamo', 'Casa demo', 'compartida');
    expect(s.household?.isDemo).toBe(true);
    expect(s.assets.length).toBe(5);
    expect(s.assets.every((a) => a.origin === 'demo')).toBe(true);
    expect(s.spaces.every((x) => x.isDemo)).toBe(true);
  });
});
