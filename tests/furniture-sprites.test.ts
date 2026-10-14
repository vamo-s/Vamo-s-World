import { describe, expect, it } from 'vitest';
import { furnitureKind } from '../src/ui/isoFurniture';

describe('dibujo de muebles por nombre', () => {
  it('reconoce los muebles comunes y cae en caja si no sabe', () => {
    const k = (name: string, subcategory = 'Mueble') => furnitureKind({ name, subcategory });
    expect(k('Cama 2 plazas')).toBe('cama');
    expect(k('Sillón 3 cuerpos')).toBe('sillon');
    expect(k('Sofá cama')).toBe('sillon');
    expect(k('Silla gamer')).toBe('silla');
    expect(k('Mesa ratona')).toBe('mesa');
    expect(k('Escritorio')).toBe('escritorio');
    expect(k('Heladera', 'Electrodoméstico')).toBe('heladera');
    expect(k('Smart TV 50"', 'Televisor')).toBe('tele');
    expect(k('Placard')).toBe('ropero');
    expect(k('Lámpara de pie')).toBe('lampara');
    expect(k('Notebook', 'Computadora')).toBe('compu');
    expect(k('Caja de herramientas', 'Herramienta')).toBe('caja');
  });
});
