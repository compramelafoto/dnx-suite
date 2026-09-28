import { esCandidataACerrar } from "./cleanup";
import { ACCIONES_CON_MENSAJE, type AccionVenta, type EstadoSugerencia, type PrioridadVenta } from "./constants";
import type { OportunidadVenta } from "./opportunity";

export type GrupoBandeja = "PARA_CERRAR" | "HOY" | "ESPERANDO";

/** Lo mínimo de la sugerencia vigente que hace falta para clasificar la tarjeta. */
export type SugerenciaVigenteParaClasificar = {
  accion: AccionVenta;
  prioridad: PrioridadVenta;
  estado: EstadoSugerencia;
  motivo: string;
} | null;

export type Clasificacion = {
  grupo: GrupoBandeja;
  accionHoy: boolean;
  prioridad: PrioridadVenta | null;
  motivoCierre: string | null;
};

/**
 * A qué pestaña de la bandeja pertenece una oportunidad abierta y no archivada (spec §6.4).
 * Módulo PURO: `bandeja`, en `repository.ts`, la usa después de traer los datos de la base.
 *
 * El orden de las reglas importa: PARA_CERRAR gana aunque la sugerencia vigente sea otra —una
 * oportunidad puede tener una sugerencia ESCRIBIR de hace tres semanas y una fecha de evento que
 * ya pasó, y en ese caso lo que hay que ofrecer es cerrarla, no escribirle.
 */
export function clasificarTarjeta(input: {
  oportunidad: OportunidadVenta;
  staleDays: number;
  hoy: Date;
  sugerencia: SugerenciaVigenteParaClasificar;
}): Clasificacion {
  const { oportunidad, sugerencia } = input;
  const candidata = esCandidataACerrar({ oportunidad, staleDays: input.staleDays, hoy: input.hoy });

  if (candidata.cerrar || sugerencia?.accion === "CERRAR_PERDIDA") {
    return {
      grupo: "PARA_CERRAR",
      accionHoy: false,
      prioridad: sugerencia?.prioridad ?? null,
      motivoCierre: candidata.motivo ?? sugerencia?.motivo ?? null,
    };
  }

  if (
    sugerencia?.estado === "PENDIENTE" &&
    (ACCIONES_CON_MENSAJE.includes(sugerencia.accion) || sugerencia.accion === "REVISAR_A_MANO")
  ) {
    return { grupo: "HOY", accionHoy: true, prioridad: sugerencia.prioridad, motivoCierre: null };
  }

  return { grupo: "ESPERANDO", accionHoy: false, prioridad: sugerencia?.prioridad ?? null, motivoCierre: null };
}
