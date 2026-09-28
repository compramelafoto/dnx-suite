import type { PrioridadVenta } from "./constants";

export type TarjetaOrdenable = {
  accionHoy: boolean;
  prioridad: PrioridadVenta | null;
  fechaEvento: Date | null;
};

const PESO: Record<PrioridadVenta, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };

/** Orden de la bandeja (spec §6.4). No muta el arreglo recibido. Módulo PURO. */
export function ordenarBandeja<T extends TarjetaOrdenable>(tarjetas: T[]): T[] {
  return [...tarjetas].sort((a, b) => {
    if (a.accionHoy !== b.accionHoy) return a.accionHoy ? -1 : 1;
    const pa = a.prioridad ? PESO[a.prioridad] : 3;
    const pb = b.prioridad ? PESO[b.prioridad] : 3;
    if (pa !== pb) return pa - pb;
    const fa = a.fechaEvento?.getTime() ?? Number.POSITIVE_INFINITY;
    const fb = b.fechaEvento?.getTime() ?? Number.POSITIVE_INFINITY;
    return fa - fb;
  });
}
