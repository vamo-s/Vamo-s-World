// Modelo de dominio de Vamo's House. Sin dependencias de UI ni de persistencia.

export const SCHEMA_VERSION = 3;

/** Origen del dato: nunca mezclar lo declarado con lo verificado o lo ficticio. */
export type DataOrigin = 'declarado' | 'verificado' | 'estimado' | 'demo';

export interface Base {
  id: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
  archivedAt?: string;
}

export interface Player extends Base {
  alias: string;
}

export type HomeTenure = 'propia' | 'alquilada' | 'compartida';

export interface Household extends Base {
  name: string;
  tenure: HomeTenure;
  isDemo: boolean;
  /** Foto del boceto a mano, de fondo en el modo construcción para calcar el plano. */
  sketch?: Sketch;
  /** Terreno donde se construye, en cm desde (0, 0). Sin dato, se calcula para que entre lo que hay. */
  lot?: { w: number; d: number };
}

/** Imagen reducida (data URL) ubicada en el plano: esquina (x, y) y ancho real en cm. */
export interface Sketch {
  image: string;
  x: number;
  y: number;
  w: number;
  opacity: number;
}

export type SpaceKind =
  | 'cocina' | 'dormitorio' | 'bano' | 'lavadero' | 'escritorio'
  | 'living' | 'garaje' | 'patio' | 'deposito' | 'otro';

export interface Space extends Base {
  householdId: string;
  name: string;
  kind: SpaceKind;
  /** Zona/estante dentro de otro espacio (jerarquía hogar > espacio > zona). */
  parentId?: string;
  isDemo: boolean;
  /** Ubicación y tamaño en el plano, en centímetros declarados por el usuario (no medidos por la app). */
  layout?: Rect;
}

export interface Rect { x: number; y: number; w: number; d: number }

export type AssetKind = 'activo' | 'consumible' | 'instalacion';

export type AssetTenure =
  | 'propio' | 'de_otra_persona' | 'del_inmueble' | 'compartido'
  | 'prestado' | 'alquilado' | 'en_custodia';

export type Condition = 'nuevo' | 'bueno' | 'regular' | 'malo' | 'roto';

export type TemplateId = 'generico' | 'puerta' | 'computadora' | 'alimento' | 'prenda';

export type AttrValue = string | number | boolean;

export interface Money {
  amount: number;
  currency: 'ARS';
}

export interface Asset extends Base {
  householdId: string;
  name: string;
  kind: AssetKind;
  groupId: string;
  subcategory: string;
  templateId: TemplateId;
  spaceId?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  brand?: string;
  model?: string;
  serial?: string;
  acquiredAt?: string;
  cost?: Money;
  condition?: Condition;
  tenure: AssetTenure;
  owner?: string;
  custodian?: string;
  origin: DataOrigin;
  attributes: Record<string, AttrValue>;
  /** Foto opcional reducida, guardada localmente como data URL. */
  photo?: string;
  /** Lugar en el plano relativo a la habitación, en centímetros. */
  place?: Rect;
}

export type AssetEventType = 'creado' | 'editado' | 'movido' | 'estado' | 'tenencia' | 'archivado' | 'restaurado';

/** Evento fechado y auditable. Las acciones físicas son siempre declaradas. */
export interface AssetEvent {
  id: string;
  householdId: string;
  assetId: string;
  type: AssetEventType;
  at: string;
  detail: string;
  origin: 'declarado';
}

export type TaskStatus = 'pendiente' | 'en_curso' | 'hecha' | 'cancelada';
export type Priority = 'baja' | 'media' | 'alta';

export interface MaintenanceTask extends Base {
  householdId: string;
  title: string;
  description?: string;
  assetId?: string;
  spaceId?: string;
  /** AAAA-MM-DD, siempre la pone el usuario: la app no inventa fechas técnicas. */
  dueDate?: string;
  priority: Priority;
  assignee?: string;
  status: TaskStatus;
  /** Evidencia declarada (texto); una foto se guarda en el objeto. */
  evidence?: string;
  completedAt?: string;
  log: { at: string; text: string }[];
}

export type MoneyType = 'ingreso' | 'gasto';

export interface MoneyEntry extends Base {
  householdId: string;
  type: MoneyType;
  amount: number;
  currency: 'ARS';
  /** AAAA-MM-DD en hora de Córdoba. */
  date: string;
  category: string;
  note?: string;
  /** 'real' = lo cargó el usuario como movimiento hecho; 'simulado' = plan o prueba. */
  nature: 'real' | 'simulado';
  assetId?: string;
}

export interface Budget extends Base {
  householdId: string;
  category: string;
  /** Límite mensual de gasto real en ARS. */
  monthly: number;
}

export type HolidayKind = 'feriado' | 'cultural' | 'juego';

export interface Holiday {
  id: string;
  name: string;
  kind: HolidayKind;
  /** MM-DD si se repite cada año. */
  monthDay?: string;
  /** Solo para la festividad DEMO: cae siempre en el día de hoy. */
  alwaysToday?: boolean;
  region: string;
  source: string;
  active: boolean;
  xp: number;
  /** Días posteriores en los que todavía se puede reclamar. */
  claimWindowDays: number;
  isDemo: boolean;
  custom?: boolean;
}

/** XP sin valor monetario. `key` es idempotente: una recompensa por clave. */
export interface XPEvent {
  id: string;
  key: string;
  kind: 'mision' | 'festividad';
  reason: string;
  xp: number;
  at: string;
}

export type Side = 'n' | 'e' | 's' | 'w';

/** Puerta o ventana sobre un lado de una habitación. Medidas en centímetros. */
export interface Opening extends Base {
  householdId: string;
  spaceId: string;
  kind: 'puerta' | 'ventana';
  side: Side;
  /** Distancia desde el inicio del lado (n/s desde la izquierda, e/w desde arriba en el plano). */
  offset: number;
  width: number;
  height: number;
  /** Puerta registrada en el inventario (ficha con medidas, estado, tenencia). */
  assetId?: string;
  /** Lado de las bisagras: al inicio o al final del hueco (solo puertas). */
  hinge?: 'inicio' | 'fin';
}

export type ProjectStatus = 'borrador' | 'planificado' | 'hecho' | 'cancelado';

/** Proyecto de mejora. En el MVP solo existe "Cambiar una puerta" y todo su catálogo es DEMO. */
export interface ImprovementProject extends Base {
  householdId: string;
  kind: 'cambiar-puerta';
  title: string;
  status: ProjectStatus;
  targetAssetId?: string;
  productId?: string;
  install?: 'profesional' | 'propia';
  plannedDate?: string;
  taskId?: string;
  isDemo: true;
}

export interface AppState {
  schemaVersion: number;
  player: Player | null;
  household: Household | null;
  spaces: Space[];
  assets: Asset[];
  events: AssetEvent[];
  tasks: MaintenanceTask[];
  money: MoneyEntry[];
  budgets: Budget[];
  holidays: Holiday[];
  xp: XPEvent[];
  openings: Opening[];
  projects: ImprovementProject[];
}

export const emptyState = (): AppState => ({
  schemaVersion: SCHEMA_VERSION,
  player: null,
  household: null,
  spaces: [],
  assets: [],
  events: [],
  tasks: [],
  money: [],
  budgets: [],
  holidays: defaultHolidays(),
  xp: [],
  openings: [],
  projects: [],
});

const AR = 'Argentina';
const LEY = 'Ley 27.399 (feriados nacionales inamovibles)';
const h = (id: string, name: string, monthDay: string, kind: HolidayKind, source: string, xp = 20): Holiday =>
  ({ id, name, monthDay, kind, region: AR, source, active: true, xp, claimWindowDays: 3, isDemo: false });

/** Solo fechas fijas. Los feriados trasladables cambian cada año: se agregan a mano desde la app. */
export function defaultHolidays(): Holiday[] {
  return [
    { id: 'demo', name: 'Festividad DEMO', kind: 'juego', alwaysToday: true, region: 'Juego', source: "Evento de prueba de Vamo's House",
      active: true, xp: 10, claimWindowDays: 0, isDemo: true },
    h('anio-nuevo', 'Año Nuevo', '01-01', 'feriado', LEY),
    h('memoria', 'Día Nacional de la Memoria por la Verdad y la Justicia', '03-24', 'feriado', LEY),
    h('malvinas', 'Día del Veterano y de los Caídos en Malvinas', '04-02', 'feriado', LEY),
    h('trabajador', 'Día del Trabajador', '05-01', 'feriado', LEY),
    h('revolucion-mayo', 'Revolución de Mayo', '05-25', 'feriado', LEY),
    h('belgrano', 'Paso a la Inmortalidad de Belgrano', '06-20', 'feriado', LEY),
    h('independencia', 'Día de la Independencia', '07-09', 'feriado', LEY),
    h('amigo', 'Día del Amigo', '07-20', 'cultural', 'Celebración cultural, no es feriado', 10),
    h('primavera', 'Día de la Primavera', '09-21', 'cultural', 'Celebración cultural, no es feriado', 10),
    h('inmaculada', 'Inmaculada Concepción de María', '12-08', 'feriado', LEY),
    h('navidad', 'Navidad', '12-25', 'feriado', LEY),
  ];
}
