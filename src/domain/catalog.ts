// Catálogo DEMO para el proyecto "Cambiar una puerta". Productos genéricos y precios ilustrativos:
// no son ofertas reales, no tienen marca ni tienda y no se pueden comprar desde la app.

export interface DemoDoor {
  id: string;
  name: string;
  width: number;
  height: number;
  material: string;
  /** Precio ilustrativo en pesos enteros (ARS). */
  price: number;
  isDemo: true;
}

const door = (id: string, name: string, width: number, material: string, price: number): DemoDoor =>
  ({ id, name, width, height: 200, material, price, isDemo: true });

export const DEMO_DOORS: DemoDoor[] = [
  door('demo-placa-70', 'Puerta placa genérica 70 cm', 70, 'MDF', 95000),
  door('demo-placa-75', 'Puerta placa genérica 75 cm', 75, 'MDF', 99000),
  door('demo-placa-80', 'Puerta placa genérica 80 cm', 80, 'MDF', 104000),
  door('demo-placa-90', 'Puerta placa genérica 90 cm', 90, 'MDF', 118000),
  door('demo-madera-70', 'Puerta de madera genérica 70 cm', 70, 'Madera', 180000),
  door('demo-madera-80', 'Puerta de madera genérica 80 cm', 80, 'Madera', 195000),
];

/** Extras ilustrativos (pesos enteros). */
export const DEMO_EXTRAS = { herrajes: 28000, profesional: 85000 };

export const DOOR_TOOLS = [
  'Destornillador plano y Phillips', 'Metro o cinta métrica', 'Nivel', 'Lápiz de carpintero',
  'Cuñas de madera', 'Formón (si hay que ajustar bisagras)', 'Guantes y anteojos de protección',
];

/** Tolerancia para considerar que una hoja estándar entra en el vano existente. */
export const FIT_TOL = { width: 2, height: 5 };
