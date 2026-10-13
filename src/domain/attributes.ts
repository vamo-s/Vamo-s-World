import type { AttrValue, TemplateId } from './types';

// Esquema extensible y validado de atributos específicos por plantilla.
// Ningún atributo es obligatorio: registro rápido con nombre + categoría, detalles después.

export interface AttributeDef {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'date' | 'boolean';
  unit?: string;
  options?: string[];
  min?: number;
}

export const TEMPLATES: Record<TemplateId, { name: string; attributes: AttributeDef[] }> = {
  generico: { name: 'Genérico', attributes: [] },
  puerta: {
    name: 'Puerta',
    attributes: [
      { key: 'alto', label: 'Alto', type: 'number', unit: 'cm', min: 0 },
      { key: 'ancho', label: 'Ancho', type: 'number', unit: 'cm', min: 0 },
      { key: 'espesor', label: 'Espesor', type: 'number', unit: 'mm', min: 0 },
      { key: 'material', label: 'Material', type: 'select', options: ['Madera', 'MDF', 'Metal', 'Aluminio', 'PVC', 'Vidrio', 'Otro'] },
      { key: 'apertura', label: 'Apertura', type: 'select', options: ['Izquierda', 'Derecha', 'Corrediza', 'Vaivén', 'Otra'] },
      { key: 'bisagras', label: 'Bisagras', type: 'number', min: 0 },
      { key: 'cerradura', label: 'Cerradura', type: 'text' },
      { key: 'marco', label: 'Compatibilidad de marco', type: 'text' },
    ],
  },
  computadora: {
    name: 'Computadora',
    attributes: [
      { key: 'cpu', label: 'CPU', type: 'text' },
      { key: 'ram', label: 'RAM', type: 'number', unit: 'GB', min: 0 },
      { key: 'almacenamiento', label: 'Almacenamiento', type: 'number', unit: 'GB', min: 0 },
      { key: 'so', label: 'Sistema operativo', type: 'text' },
      { key: 'garantia', label: 'Garantía hasta', type: 'date' },
    ],
  },
  alimento: {
    name: 'Alimento',
    attributes: [
      { key: 'vencimiento', label: 'Vencimiento', type: 'date' },
      { key: 'lote', label: 'Lote', type: 'text' },
      { key: 'abierto', label: 'Abierto', type: 'boolean' },
    ],
  },
  prenda: {
    name: 'Prenda',
    attributes: [
      { key: 'talle', label: 'Talle', type: 'text' },
      { key: 'material', label: 'Material', type: 'text' },
      { key: 'color', label: 'Color', type: 'text' },
      { key: 'cuidado', label: 'Instrucciones de cuidado', type: 'text' },
    ],
  },
};

export interface AttrValidation {
  ok: boolean;
  errors: Record<string, string>;
  values: Record<string, AttrValue>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida y normaliza atributos crudos (strings de formulario o valores importados).
 * Descarta claves desconocidas y vacías; nunca acepta JSON arbitrario.
 */
export function validateAttributes(templateId: TemplateId, raw: Record<string, unknown>): AttrValidation {
  const defs = TEMPLATES[templateId]?.attributes ?? [];
  const errors: Record<string, string> = {};
  const values: Record<string, AttrValue> = {};
  for (const d of defs) {
    const v = raw[d.key];
    if (v === undefined || v === null || v === '') continue;
    switch (d.type) {
      case 'number': {
        const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
        if (!Number.isFinite(n)) errors[d.key] = 'Tiene que ser un número';
        else if (d.min !== undefined && n < d.min) errors[d.key] = `Mínimo ${d.min}`;
        else values[d.key] = n;
        break;
      }
      case 'boolean':
        if (typeof v === 'boolean') values[d.key] = v;
        else if (v === 'true' || v === 'false') values[d.key] = v === 'true';
        else errors[d.key] = 'Valor inválido';
        break;
      case 'select':
        if (d.options?.includes(String(v))) values[d.key] = String(v);
        else errors[d.key] = 'Opción inválida';
        break;
      case 'date':
        if (DATE_RE.test(String(v))) values[d.key] = String(v);
        else errors[d.key] = 'Fecha inválida (AAAA-MM-DD)';
        break;
      default:
        values[d.key] = String(v).slice(0, 300);
    }
  }
  return { ok: Object.keys(errors).length === 0, errors, values };
}
