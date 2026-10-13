import { addAsset, addSpace, setupHousehold, type Clock } from './inventory';
import type { AppState, HomeTenure } from './types';

/** Datos de ejemplo: todos marcados isDemo / origin 'demo' y visibles como DEMO en la UI. */
export function seedDemo(s: AppState, c: Clock, alias: string, homeName: string, tenure: HomeTenure): AppState {
  let st = setupHousehold(s, c, { alias, homeName, tenure, isDemo: true });
  const rooms: [string, Parameters<typeof addSpace>[2]['kind']][] = [
    ['Cocina', 'cocina'], ['Dormitorio', 'dormitorio'], ['Baño', 'bano'], ['Lavadero', 'lavadero'], ['Escritorio', 'escritorio'],
  ];
  for (const [name, kind] of rooms) st = addSpace(st, c, { name, kind, isDemo: true });
  const id = (n: string) => st.spaces.find((x) => x.name === n)!.id;
  const common = { tenure: 'propio' as const, origin: 'demo' as const };
  st = addAsset(st, c, { ...common, name: 'Puerta del dormitorio (ejemplo)', kind: 'instalacion', groupId: 'vivienda', subcategory: 'Puerta', templateId: 'puerta', spaceId: id('Dormitorio'), tenure: 'del_inmueble', attributes: { alto: 200, ancho: 70, material: 'MDF', apertura: 'Derecha' } });
  st = addAsset(st, c, { ...common, name: 'Notebook (ejemplo)', kind: 'activo', groupId: 'equipamiento', subcategory: 'Computadora', templateId: 'computadora', spaceId: id('Escritorio'), attributes: { ram: 16, almacenamiento: 512 } });
  st = addAsset(st, c, { ...common, name: 'Lavarropas (ejemplo)', kind: 'activo', groupId: 'equipamiento', subcategory: 'Electrodoméstico', templateId: 'generico', spaceId: id('Lavadero'), condition: 'bueno' });
  st = addAsset(st, c, { ...common, name: 'Arroz (ejemplo)', kind: 'consumible', groupId: 'consumibles', subcategory: 'Alimentos', templateId: 'alimento', spaceId: id('Cocina'), quantity: 1, unit: 'kg' });
  st = addAsset(st, c, { ...common, name: 'Campera azul (ejemplo)', kind: 'activo', groupId: 'personales', subcategory: 'Ropa', templateId: 'prenda', spaceId: id('Dormitorio'), attributes: { talle: 'L', color: 'Azul' } });
  return st;
}
