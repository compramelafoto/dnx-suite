/**
 * Piezas PURAS de la ficha de un registro con recorrido: cómo se cuenta cada paso del historial
 * y qué tareas se muestran. Sin base ni `server-only`: las usan el servidor y las pruebas.
 */
import { ETIQUETA_EVENTO, ETIQUETA_SALIDA } from "./constantes";

export const SISTEMA = "Sistema";
export const ETAPA_BORRADA = "Etapa borrada";
export const AVISO_DESDE_HOY = "Los plazos se calcularon desde hoy porque la etapa está vencida.";
export const AVANZO_CON_PENDIENTES = "avanzó con tareas pendientes";

export type ClasePaso = "inicio" | "movimiento" | "cierre" | "vencimiento";

export type PasoCrudo = {
  id: string;
  fromStageId: string | null;
  toStageId: string | null;
  outcome: string | null;
  note: string | null;
  auto: boolean;
  event: string | null;
  forcedWithPendingTasks: boolean;
  actorLabel: string;
  createdAt: Date;
};

export type PasoVista = {
  id: string;
  /** ISO. */
  fecha: string;
  clase: ClasePaso;
  /** "Sistema" si fue automático; si no, quien lo hizo. */
  quien: string;
  /** Qué lo disparó, si fue un evento ("Llegó una consulta nueva"). */
  evento: string | null;
  de: string | null;
  a: string | null;
  nota: string | null;
  forzada: boolean;
};

/**
 * Cómo se cuenta un paso: un paso de una etapa a sí misma es un cambio de vencimiento (la nota
 * dice "Vencimiento cambiado…"); sin etapa de origen es la entrada al circuito; con resultado,
 * el cierre. Una etapa que ya no existe se nombra "Etapa borrada".
 */
export function describirPaso(p: PasoCrudo, nombres: ReadonlyMap<string, string>): PasoVista {
  const nombre = (id: string | null) => (id === null ? null : (nombres.get(id) ?? ETAPA_BORRADA));
  const clase: ClasePaso =
    p.outcome !== null
      ? "cierre"
      : p.fromStageId !== null && p.fromStageId === p.toStageId
        ? "vencimiento"
        : p.fromStageId === null
          ? "inicio"
          : "movimiento";
  const evento = p.event && Object.hasOwn(ETIQUETA_EVENTO, p.event) ? ETIQUETA_EVENTO[p.event as keyof typeof ETIQUETA_EVENTO] : null;
  return {
    id: p.id,
    fecha: p.createdAt.toISOString(),
    clase,
    quien: p.auto ? SISTEMA : p.actorLabel,
    evento: p.auto ? evento : null,
    de: clase === "inicio" ? null : nombre(p.fromStageId),
    a: clase === "cierre" ? (ETIQUETA_SALIDA[p.outcome!] ?? p.outcome) : nombre(p.toStageId),
    nota: p.note,
    forzada: p.forcedWithPendingTasks,
  };
}

export type TareaCruda = {
  id: string;
  title: string;
  dueAt: Date | null;
  doneAt: Date | null;
  required: boolean;
  stageId: string | null;
};

export type TareaFicha = {
  id: string;
  titulo: string;
  /** ISO. */
  vence: string | null;
  vencida: boolean;
  hecha: boolean;
  obligatoria: boolean;
  /** Nombre de la etapa de la que viene; null = agregada a mano. */
  etapa: string | null;
  suelta: boolean;
  /** Pendiente que quedó de una etapa por la que ya pasó. */
  deEtapaAnterior: boolean;
};

/**
 * Las tareas que muestra la ficha: todas las de la etapa actual, todas las agregadas a mano y
 * las pendientes de etapas anteriores (las hechas de etapas anteriores ya no importan). Con el
 * recorrido cerrado (`etapaActualId = null`) quedan las sueltas y las pendientes.
 */
export function tareasVisibles(
  tareas: TareaCruda[],
  etapaActualId: string | null,
  nombres: ReadonlyMap<string, string>,
  ahora: Date,
): TareaFicha[] {
  return tareas
    .filter((t) => t.stageId === null || t.stageId === etapaActualId || t.doneAt === null)
    .map((t) => ({
      id: t.id,
      titulo: t.title,
      vence: t.dueAt ? t.dueAt.toISOString() : null,
      vencida: t.doneAt === null && t.dueAt !== null && t.dueAt.getTime() < ahora.getTime(),
      hecha: t.doneAt !== null,
      obligatoria: t.required,
      etapa: t.stageId === null ? null : (nombres.get(t.stageId) ?? ETAPA_BORRADA),
      suelta: t.stageId === null,
      deEtapaAnterior: t.stageId !== null && t.stageId !== etapaActualId,
    }));
}

/** Fin del día (Buenos Aires) de una fecha "AAAA-MM-DD" elegida en la ficha; null si no es válida. */
export function finDelDiaElegido(ymd: string): Date | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(ymd)) return null;
  if (!new Date(`${ymd}T00:00:00Z`).toISOString().startsWith(ymd)) return null;
  return new Date(`${ymd}T23:59:59.999-03:00`);
}
