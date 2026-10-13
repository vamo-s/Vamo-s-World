import type { AssetKind, TemplateId } from './types';

// Taxonomía base de seis grupos. Ampliable: las subcategorías son texto libre validado contra
// esta lista solo como sugerencia, así se pueden agregar categorías del usuario sin migrar.

export interface TaxonomyGroup {
  id: string;
  name: string;
  defaultKind: AssetKind;
  subcategories: { name: string; template?: TemplateId; kind?: AssetKind }[];
}

export const TAXONOMY: TaxonomyGroup[] = [
  {
    id: 'vivienda', name: 'Vivienda y espacios', defaultKind: 'instalacion',
    subcategories: [
      { name: 'Puerta', template: 'puerta' }, { name: 'Ventana' }, { name: 'Piso' },
      { name: 'Pared' }, { name: 'Techo' }, { name: 'Mobiliario fijo' }, { name: 'Abertura' },
    ],
  },
  {
    id: 'instalaciones', name: 'Instalaciones e infraestructura', defaultKind: 'instalacion',
    subcategories: [
      { name: 'Circuito eléctrico' }, { name: 'Agua' }, { name: 'Gas' }, { name: 'Climatización' },
      { name: 'Iluminación' }, { name: 'Conectividad' }, { name: 'Seguridad' }, { name: 'Saneamiento' },
      { name: 'Energía' },
    ],
  },
  {
    id: 'equipamiento', name: 'Equipamiento y tecnología', defaultKind: 'activo',
    subcategories: [
      { name: 'Electrodoméstico' }, { name: 'Computadora', template: 'computadora' }, { name: 'Red' },
      { name: 'Televisor' }, { name: 'Herramienta' }, { name: 'Domótica' }, { name: 'Comunicaciones' },
      { name: 'Mueble' },
    ],
  },
  {
    id: 'personales', name: 'Pertenencias personales', defaultKind: 'activo',
    subcategories: [
      { name: 'Ropa', template: 'prenda' }, { name: 'Calzado', template: 'prenda' }, { name: 'Accesorios' },
      { name: 'Libros' }, { name: 'Documentos' }, { name: 'Deporte' }, { name: 'Juguetes' },
      { name: 'Objetos personales' },
    ],
  },
  {
    id: 'consumibles', name: 'Consumibles y existencias', defaultKind: 'consumible',
    subcategories: [
      { name: 'Alimentos', template: 'alimento' }, { name: 'Bebidas', template: 'alimento' },
      { name: 'Higiene' }, { name: 'Limpieza' }, { name: 'Medicamentos (registro privado)' },
      { name: 'Repuestos' }, { name: 'Insumos' },
    ],
  },
  {
    id: 'exterior', name: 'Movilidad y exterior', defaultKind: 'activo',
    subcategories: [
      { name: 'Bicicleta' }, { name: 'Vehículo' }, { name: 'Jardín' }, { name: 'Plantas' },
      { name: 'Riego' }, { name: 'Equipamiento exterior' },
    ],
  },
];

export const groupById = (id: string) => TAXONOMY.find((g) => g.id === id);

/** Plantilla y tipo sugeridos para una subcategoría; el usuario puede cambiarlos. */
export function suggestFor(groupId: string, subcategory: string): { template: TemplateId; kind: AssetKind } {
  const g = groupById(groupId);
  const s = g?.subcategories.find((x) => x.name === subcategory);
  return { template: s?.template ?? 'generico', kind: s?.kind ?? g?.defaultKind ?? 'activo' };
}
