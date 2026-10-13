import type { AssetKind, AssetTenure, Condition, DataOrigin, HomeTenure, SpaceKind } from './types';

export const HOME_TENURE: Record<HomeTenure, string> = {
  propia: 'Propia', alquilada: 'Alquilada', compartida: 'Compartida',
};

export const SPACE_KINDS: Record<SpaceKind, string> = {
  cocina: 'Cocina', dormitorio: 'Dormitorio', bano: 'Baño', lavadero: 'Lavadero',
  escritorio: 'Escritorio', living: 'Living', garaje: 'Garaje', patio: 'Patio',
  deposito: 'Depósito', otro: 'Otro',
};

export const ASSET_KINDS: Record<AssetKind, string> = {
  activo: 'Objeto / equipo', consumible: 'Consumible', instalacion: 'Instalación',
};

export const ASSET_TENURE: Record<AssetTenure, string> = {
  propio: 'Mío', de_otra_persona: 'De otra persona', del_inmueble: 'Del inmueble',
  compartido: 'Compartido', prestado: 'Prestado', alquilado: 'Alquilado', en_custodia: 'En custodia',
};

export const CONDITIONS: Record<Condition, string> = {
  nuevo: 'Nuevo', bueno: 'Bueno', regular: 'Regular', malo: 'Malo', roto: 'Roto',
};

export const ORIGINS: Record<DataOrigin, string> = {
  declarado: 'Declarado', verificado: 'Verificado', estimado: 'Estimado', demo: 'DEMO',
};
