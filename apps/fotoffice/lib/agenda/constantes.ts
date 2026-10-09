/**
 * Constantes de la Agenda (Etapa 4, Entrega B). Módulo PURO: sin acceso a la base.
 */

/** Estados de una cita (el SQL los fuerza con un CHECK). */
export const ESTADOS_CITA = ["AGENDADA", "CONFIRMADA", "REALIZADA", "ANULADA"] as const;
export type EstadoCita = (typeof ESTADOS_CITA)[number];

export const ETIQUETA_ESTADO_CITA: Record<EstadoCita, string> = {
  AGENDADA: "Agendada",
  CONFIRMADA: "Confirmada",
  REALIZADA: "Realizada",
  ANULADA: "Anulada",
};

export function esEstadoCita(valor: unknown): valor is EstadoCita {
  return typeof valor === "string" && (ESTADOS_CITA as readonly string[]).includes(valor);
}

/** Capas de la vista de agenda. */
export const CLAVES_CAPA = ["CITAS", "ENTREGAS", "TAREAS", "CUOTAS", "CONSULTAS", "CUMPLEANOS", "RESERVAS"] as const;
export type ClaveCapa = (typeof CLAVES_CAPA)[number];

export const ETIQUETA_CAPA: Record<ClaveCapa, string> = {
  CITAS: "Citas",
  ENTREGAS: "Entregas de proyectos",
  TAREAS: "Tareas con vencimiento",
  CUOTAS: "Vencimientos de cuotas",
  CONSULTAS: "Próxima acción de consultas",
  CUMPLEANOS: "Cumpleaños",
  RESERVAS: "Reservas",
};

/** Color de cada capa (las citas toman el color de su tipo; éste es el de las que no tienen tipo). */
export const COLOR_CAPA: Record<ClaveCapa, string> = {
  CITAS: "#2563eb",
  ENTREGAS: "#7c3aed",
  TAREAS: "#0d9488",
  CUOTAS: "#dc2626",
  CONSULTAS: "#d97706",
  CUMPLEANOS: "#db2777",
  RESERVAS: "#16a34a",
};

/** Las capas que se muestran encendidas la primera vez. */
export const CAPAS_POR_OMISION: readonly ClaveCapa[] = ["CITAS", "ENTREGAS", "TAREAS", "CONSULTAS", "RESERVAS"];

export function esClaveCapa(valor: unknown): valor is ClaveCapa {
  return typeof valor === "string" && (CLAVES_CAPA as readonly string[]).includes(valor);
}

/** Color por omisión de un tipo de cita sin color. */
export const COLOR_TIPO_POR_OMISION = "#6b7280";

/** Rangos de las reglas de producto (iguales que los CHECK del SQL). */
export const DIAS_DESDE_EVENTO_MIN = -365;
export const DIAS_DESDE_EVENTO_MAX = 365;
export const DURACION_MINUTOS_MIN = 15;
export const DURACION_MINUTOS_MAX = 1440;
export const DURACION_MINUTOS_POR_OMISION = 60;
export const HORAS_RECORDATORIO_MIN = 1;
export const HORAS_RECORDATORIO_MAX = 168;
export const HORAS_RECORDATORIO_POR_OMISION = 24;

/** Hasta dónde se baja dentro de combos anidados (el catálogo no tiene ciclos; es un resguardo). */
export const PROFUNDIDAD_MAXIMA_COMBOS = 10;

/** Huso horario de todas las fechas de la agenda. */
export const HUSO_HORARIO = "America/Argentina/Buenos_Aires";

/** Argentina no tiene horario de verano: siempre UTC−3. */
export const DESFASE_ARGENTINA_HORAS = 3;

/** Los tipos de cita que se siembran en cada organización (idempotente por nombre). */
export const TIPOS_DE_CITA_INICIALES = [
  { name: "Reunión con cliente", color: "#2563eb" },
  { name: "Evento", color: "#dc2626" },
  { name: "Sesión de fotos", color: "#16a34a" },
  { name: "Entrega", color: "#7c3aed" },
  { name: "Prueba / ensayo", color: "#ea580c" },
  { name: "Otro", color: "#6b7280" },
] as const;

/** Marca de los eventos de Google que empuja la agenda para las entregas de proyectos (sólo ida). */
export const CLAVE_TIPO_EVENTO_GOOGLE = "foKind";
export const VALOR_EVENTO_ENTREGA = "entrega";
export const PREFIJO_ENTREGA = "Entrega: ";
