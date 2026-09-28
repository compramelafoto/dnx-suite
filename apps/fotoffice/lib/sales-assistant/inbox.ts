import { esCandidataACerrar } from "./cleanup";
import {
  ACCIONES_CON_MENSAJE,
  type AccionVenta,
  type EstadoSugerencia,
  type PrioridadVenta,
  type TipoSeguimiento,
} from "./constants";
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

/**
 * Si hay un WhatsApp enviado del que todavía no se anotó qué contestó el cliente: el último
 * MENSAJE_ENVIADO sin un RESULTADO posterior. Mientras sea así, la tarjeta y el detalle ofrecen
 * los botones de resultado, sea cual sea la sugerencia vigente (el análisis del día siguiente
 * puede haber creado otra, y eso no puede esconder la pregunta). Módulo PURO.
 *
 * `sugerenciaId` es la sugerencia de ese envío, para colgar el resultado de ella.
 */
export function esperaResultado(
  seguimientos: Array<{ tipo: TipoSeguimiento; fecha: Date; sugerenciaId: string | null }>,
): { espera: boolean; sugerenciaId: string | null } {
  let envio: { fecha: Date; sugerenciaId: string | null } | null = null;
  let ultimoResultado: Date | null = null;
  for (const s of seguimientos) {
    if (s.tipo === "MENSAJE_ENVIADO" && (!envio || s.fecha.getTime() > envio.fecha.getTime())) envio = s;
    if (s.tipo === "RESULTADO" && (!ultimoResultado || s.fecha.getTime() > ultimoResultado.getTime())) {
      ultimoResultado = s.fecha;
    }
  }
  if (!envio || (ultimoResultado && ultimoResultado.getTime() > envio.fecha.getTime())) {
    return { espera: false, sugerenciaId: null };
  }
  return { espera: true, sugerenciaId: envio.sugerenciaId };
}
