import { chargePeriodLabel } from "./charge-labels";
import { decimalArsToMinor } from "./money";
import { isHistoricalPayment, paymentMethodLabel } from "./payment-method";

/**
 * Las entradas del historial de pagos: de filas de la base a lo que lee el socio.
 *
 * Vive separado de la consulta —igual que `select-charges.ts` respecto de `account.ts`—
 * porque acá se decide el vocabulario y el orden, y eso tiene que poder probarse sin montar
 * una base.
 *
 * **Sólo entran pagos acreditados.** Esa regla la aplica la consulta, pero es de este
 * módulo: un pago pendiente o rechazado listado bajo «lo que pagaste» es una afirmación
 * falsa, y la más peligrosa de todas — el socio deja de pagar creyendo que ya está.
 */

export type PaymentHistoryEntry = {
  id: string;
  /** Cuándo se pagó. Cae en `createdAt` sólo si el pago no trae fecha propia. */
  paidAt: Date;
  amountMinor: number;
  /** Medio ya legible: nunca el valor crudo de la base. */
  methodLabel: string;
  /** Cargado a mano desde el registro anterior a FotoOffice. */
  historical: boolean;
  /** Comprobante o referencia, si hay. */
  reference: string | null;
  /**
   * Qué cargos canceló, en palabras del socio (`septiembre de 2026`). Vacío en los
   * históricos: se cargan sin imputar a ninguna cuota, a propósito.
   */
  appliedTo: string[];
};

type RawPayment = {
  id: string;
  amountArs: { toString(): string };
  method: string | null;
  providerPaymentRef: string | null;
  providerOrderRef: string | null;
  paidAt: Date | null;
  createdAt: Date;
  allocations: { charge: { period: string } }[];
};

/**
 * Parte pura: de filas de la base a lo que se muestra. Separada para poder probar el
 * vocabulario y el orden sin montar una base.
 */
export function toPaymentHistory(rows: RawPayment[]): PaymentHistoryEntry[] {
  return rows
    .map((r) => ({
      id: r.id,
      paidAt: r.paidAt ?? r.createdAt,
      amountMinor: decimalArsToMinor(r.amountArs),
      methodLabel: paymentMethodLabel({
        method: r.method,
        hasProviderRef: r.providerPaymentRef !== null,
      }),
      historical: isHistoricalPayment(r.method),
      reference: r.providerOrderRef,
      // Períodos únicos: un pago que canceló dos cargos del mismo mes —cuota e interés—
      // no tiene por qué nombrar ese mes dos veces.
      appliedTo: [...new Set(r.allocations.map((a) => chargePeriodLabel(a.charge.period)))],
    }))
    // El más reciente primero: es lo que el socio busca cuando entra a comprobar algo.
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
}
