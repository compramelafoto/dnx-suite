/**
 * Turnos de servicio (etapa 1): constantes y textos. Módulo PURO.
 * Diseño: docs/superpowers/specs/2026-10-17-turnos-de-servicio-design.md.
 */
import { HUSO_HORARIO } from "@/lib/agenda/constantes";

export const ZONA_TURNOS = HUSO_HORARIO;

export const MODALIDADES = ["ONLINE", "TELEFONO", "ESTUDIO", "DIRECCION"] as const;
export type Modalidad = (typeof MODALIDADES)[number];

export const ETIQUETA_MODALIDAD: Record<Modalidad, string> = {
  ONLINE: "Videollamada",
  TELEFONO: "Llamada telefónica",
  ESTUDIO: "En el estudio",
  DIRECCION: "En otra dirección",
};

export function esModalidad(v: unknown): v is Modalidad {
  return typeof v === "string" && (MODALIDADES as readonly string[]).includes(v);
}

export const ESTADOS_TURNO = ["CONFIRMADO", "CANCELADO"] as const;
export type EstadoTurno = (typeof ESTADOS_TURNO)[number];

export const DURACION_TURNO_MIN = 15;
export const DURACION_TURNO_MAX = 480;
export const MAX_DESCRIPCION = 2000;
export const MAX_DIRECCION = 300;
export const MAX_MENSAJE = 1500;
/** Tope de turnos futuros activos por correo (freno contra reservas falsas en masa). */
export const MAX_ACTIVOS_POR_CORREO = 3;

export type AjustesTurnos = {
  pageTitle: string | null;
  pageIntro: string | null;
  cancelWindowHours: number;
  bufferMinutes: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
  notifyEmail: string | null;
};

export const AJUSTES_TURNOS_DE_FABRICA: AjustesTurnos = {
  pageTitle: null,
  pageIntro: null,
  cancelWindowHours: 48,
  bufferMinutes: 0,
  minAdvanceHours: 24,
  maxAdvanceDays: 60,
  notifyEmail: null,
};

export const TITULO_PAGINA_POR_OMISION = "Agendá un turno";

export const MENSAJES_TURNOS = {
  datosInvalidos: "Los datos no son válidos.",
  sinPermiso: "Sólo el dueño o un administrador pueden configurar los turnos.",
  tipoNoExiste: "No encontramos ese tipo de cita.",
  guardar: "No se pudo guardar. Probá de nuevo.",
  duracion: `La duración tiene que ser de ${DURACION_TURNO_MIN} a ${DURACION_TURNO_MAX} minutos.`,
  modalidad: "Elegí cómo se hace el turno.",
  franjas: "Revisá los horarios: cada franja necesita día, hora de inicio y de fin, y no pueden pisarse.",
  sinFranjas: "Para publicar, cargá al menos un horario en que lo ofrecés.",
  direccion: "Para un turno en el estudio o en otra dirección, poné la dirección.",
  imagen: "La foto tiene que ser una dirección que empiece con https://.",
  descripcion: `La descripción puede tener hasta ${MAX_DESCRIPCION} caracteres.`,
  ajustes: "Revisá los números: anticipación de 0 a 720 horas, hasta 365 días, plazo de 0 a 720 horas y margen de 0 a 240 minutos.",
  correoAviso: "El correo de aviso no es válido.",
  nombre: "Poné tu nombre.",
  correo: "Poné un correo válido: ahí te llega la confirmación.",
  telefono: "Poné un teléfono para que podamos contactarte.",
  mensaje: `El mensaje puede tener hasta ${MAX_MENSAJE} caracteres.`,
  horario: "Elegí un día y un horario.",
  ocupado: "Ese horario se acaba de ocupar. Elegí otro.",
  noDisponible: "Ese horario ya no está disponible. Elegí otro.",
  demasiados: `Ya tenés ${MAX_ACTIVOS_POR_CORREO} turnos reservados con este correo. Si necesitás otro, escribinos.`,
  fueraDePlazo: "Ya pasó el plazo para cambiarlo por acá. Escribinos y lo vemos.",
  yaCancelado: "Este turno ya está cancelado.",
  noEncontrado: "No encontramos ese turno.",
  sinAgenda: "En este momento no podemos mostrar horarios. Probá más tarde o escribinos.",
  falla: "No pudimos reservar el turno. Probá de nuevo.",
} as const;
