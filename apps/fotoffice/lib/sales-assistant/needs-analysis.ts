import { DEFAULT_WAIT_DAYS, UMBRALES_EVENTO_DIAS, type AccionVenta, type EstadoSugerencia } from "./constants";
import type { OportunidadVenta } from "./opportunity";

/**
 * Decide si una oportunidad va a Claude hoy.
 *
 * Es la función que controla el costo: sin ella, las ~100 oportunidades abiertas irían todas,
 * todos los días, a pesar de que en la mayoría no pasó nada. Módulo PURO.
 */
export type UltimaSugerencia = {
  creadaEn: Date;
  accion: AccionVenta;
  estado: EstadoSugerencia;
  esperarHasta: Date | null;
  /** `modificadaEn` de la oportunidad al momento del análisis. */
  oportunidadModificadaEn: Date;
};

const DIA_MS = 24 * 60 * 60 * 1000;
export function diasEntre(desde: Date, hasta: Date): number {
  return Math.floor((hasta.getTime() - desde.getTime()) / DIA_MS);
}

export function necesitaAnalisis(input: {
  oportunidad: OportunidadVenta;
  ultima: UltimaSugerencia | null;
  ultimoSeguimientoEn: Date | null;
  archivada: boolean;
  forzar: boolean;
  hoy: Date;
  waitDays?: number;
}): { analizar: boolean; motivo: string } {
  const { oportunidad: op, ultima, hoy } = input;
  if (!op.abierta) return { analizar: false, motivo: "Cerrada en el CRM" };
  if (input.forzar) return { analizar: true, motivo: "Pedido a mano" };
  if (input.archivada) return { analizar: false, motivo: "Archivada" };
  if (!ultima) return { analizar: true, motivo: "Nueva" };

  if (op.modificadaEn.getTime() > ultima.oportunidadModificadaEn.getTime()) {
    return { analizar: true, motivo: "Cambió en el CRM" };
  }
  if (input.ultimoSeguimientoEn && input.ultimoSeguimientoEn.getTime() > ultima.creadaEn.getTime()) {
    return { analizar: true, motivo: "Hay un seguimiento nuevo" };
  }
  if (ultima.esperarHasta && ultima.esperarHasta.getTime() <= hoy.getTime()) {
    return { analizar: true, motivo: "Venció la espera" };
  }
  const espera = input.waitDays ?? DEFAULT_WAIT_DAYS;
  if (ultima.estado === "ENVIADA" && diasEntre(ultima.creadaEn, hoy) >= espera) {
    return { analizar: true, motivo: `Pasaron ${espera} días del último mensaje` };
  }
  if (op.fechaEvento) {
    const faltanHoy = diasEntre(hoy, op.fechaEvento);
    const faltabanAntes = diasEntre(ultima.creadaEn, op.fechaEvento);
    for (const umbral of UMBRALES_EVENTO_DIAS) {
      if (faltabanAntes >= umbral && faltanHoy < umbral) {
        return { analizar: true, motivo: `El evento está a menos de ${umbral} días` };
      }
    }
  }
  return { analizar: false, motivo: "Sin cambios" };
}
