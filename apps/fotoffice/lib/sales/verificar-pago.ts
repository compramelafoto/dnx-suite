import type { CobroMp } from "@/lib/cash/mp-cobros";

/**
 * "Verificar pago" del Mostrador. Módulo PURO: de lo que entró a la cuenta de Mercado Pago, qué
 * cobros pueden ser el de este ticket. Ver docs/fotoffice/PLAN-MOSTRADOR-QR-Y-VERIFICAR-PAGO.md.
 *
 * Un cobro sirve si está acreditado, es por el monto EXACTO y no se usó ya en otra venta. Se mira
 * hacia atrás una ventana corta: lo normal es que el cliente transfiera ahí mismo, en el mostrador.
 */

/** Cuánto hacia atrás se busca. */
export const VENTANA_VERIFICAR_MS = 2 * 60 * 60 * 1000;

export type PagoCandidato = {
  id: string;
  /** ISO. */
  fecha: string | null;
  montoMinor: number;
  pagador: string | null;
  medio: string;
};

export function candidatosDePago(cobros: readonly CobroMp[], montoMinor: number, usados: ReadonlySet<string>): PagoCandidato[] {
  return cobros
    .filter((c) => c.estado === "approved" && c.montoMinor === montoMinor && !usados.has(c.id))
    .sort((a, b) => (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0))
    .map((c) => ({ id: c.id, fecha: c.fecha ? c.fecha.toISOString() : null, montoMinor: c.montoMinor, pagador: c.pagador, medio: c.medio }));
}

/** Para la nota de la venta: de dónde salió la confirmación. */
export function notaDePagoVerificado(p: { id: string; pagador: string | null }): string {
  return `Verificado en Mercado Pago (operación ${p.id}${p.pagador ? `, de ${p.pagador}` : ""})`;
}
