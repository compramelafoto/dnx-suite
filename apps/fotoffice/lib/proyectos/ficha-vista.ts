/**
 * Piezas PURAS de la ficha del proyecto: los tipos que viajan a los componentes de cliente y las
 * cuentas chicas (estado de cada etapa del plan, atraso, etiquetas). Sin base ni `server-only`.
 */
import { atraso, fechaValida } from "./fechas";

export type EstadoDeProyecto = "EN_CURSO" | "SUSPENDIDO" | "CERRADO";
export const ETIQUETA_ESTADO: Record<EstadoDeProyecto, string> = { EN_CURSO: "En curso", SUSPENDIDO: "Suspendido", CERRADO: "Cerrado" };
export const COLOR_ESTADO: Record<EstadoDeProyecto, string> = {
  EN_CURSO: "bg-blue-100 text-blue-800",
  SUSPENDIDO: "bg-amber-100 text-amber-800",
  CERRADO: "bg-gray-100 text-gray-700",
};

/** Estado que se muestra: suspendido manda sobre en curso; un recorrido cerrado es "Cerrado". */
export function estadoDe(suspendido: boolean, recorridoCerrado: boolean): EstadoDeProyecto {
  return suspendido ? "SUSPENDIDO" : recorridoCerrado ? "CERRADO" : "EN_CURSO";
}

export type EtapaDelPlan = {
  stageId: string;
  nombre: string;
  /** "YYYY-MM-DD" o null si el proyecto no tiene plan para esa etapa. */
  plan: string | null;
  estado: "hecha" | "actual" | "pendiente" | null;
};

/**
 * El plan por etapa en el orden del flujo. Las anteriores a la actual figuran como hechas, la
 * actual como actual y las que siguen como pendientes; con el recorrido cerrado (sin etapa
 * actual) ninguna lleva estado.
 */
export function planDelRecorrido(
  etapas: readonly { id: string; nombre: string }[],
  etapaActualId: string | null,
  planes: ReadonlyMap<string, string>,
): EtapaDelPlan[] {
  const actual = etapaActualId === null ? -1 : etapas.findIndex((e) => e.id === etapaActualId);
  return etapas.map((e, i) => ({
    stageId: e.id,
    nombre: e.nombre,
    plan: planes.get(e.id) ?? null,
    estado: actual < 0 ? null : i < actual ? "hecha" : i === actual ? "actual" : "pendiente",
  }));
}

/** Atraso de un proyecto vivo contra el plan de su etapa actual; 0 si está suspendido, cerrado o sin plan. */
export function atrasoDelProyecto(estado: EstadoDeProyecto, planDeLaEtapaActual: string | Date | null, hoy: string): number {
  return estado === "EN_CURSO" ? atraso(fechaValida(planDeLaEtapaActual), hoy) : 0;
}

export type ParticipanteVista = {
  id: string;
  /** Integrante del equipo o contacto (uno solo). */
  tipo: "EQUIPO" | "CONTACTO";
  userId: number | null;
  clientId: string | null;
  nombre: string;
  roleId: string | null;
  rol: string | null;
  nota: string | null;
};

export type NotaVista = {
  id: string;
  texto: string;
  autor: string | null;
  /** ISO. */
  fecha: string;
  editada: boolean;
  /** El autor o quien puede configurar. El servidor lo vuelve a decidir en cada acción. */
  puedeModificar: boolean;
};

export type AdjuntoProyectoVista = {
  id: string;
  nombre: string;
  tipo: string;
  tamano: number;
  estado: "LISTO" | "BORRADO";
  subidoPor: string;
  fecha: string;
  restaurableHasta: string | null;
};
