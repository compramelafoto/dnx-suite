/**
 * Cómo se nombra —y cómo se reconoce— el medio de un pago.
 *
 * ── Por qué los pagos históricos se marcan en `method` y no con un campo propio ──
 *
 * `schema.prisma` es compartido por las cinco bases Neon de la suite. Una columna nueva hay
 * que aplicarla a mano en las cinco o rompe las escrituras de las otras aplicaciones, y el
 * único dato que necesitamos guardar acá es un sí/no. Viaja como prefijo del medio de pago,
 * que ya es un texto libre: `HIST:EFECTIVO`.
 *
 * El precio de esa decisión es que nadie puede leer `method` en crudo para mostrarlo. Por
 * eso este módulo es la única puerta: todo lo que muestre un medio de pago pasa por acá.
 *
 * Módulo PURO: sin base y sin red.
 */

/** Marca de "esto pasó antes de FotoOffice". Ver el comentario de arriba. */
const HISTORICAL_PREFIX = "HIST:";

/** Medios que la Secretaría puede haber usado antes del sistema. */
export const HISTORICAL_METHODS = ["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "OTRO"] as const;
export type HistoricalMethod = (typeof HISTORICAL_METHODS)[number];

export function isHistoricalMethod(value: string): value is HistoricalMethod {
  return (HISTORICAL_METHODS as readonly string[]).includes(value);
}

/** `EFECTIVO` → `HIST:EFECTIVO`. Lo que se guarda en `MembershipPayment.method`. */
export function historicalMethod(medio: HistoricalMethod): string {
  return `${HISTORICAL_PREFIX}${medio}`;
}

/** ¿Este pago se cargó como registro del sistema anterior? */
export function isHistoricalPayment(method: string | null): boolean {
  return method !== null && method.startsWith(HISTORICAL_PREFIX);
}

const ETIQUETAS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  CHEQUE: "Cheque",
  OTRO: "Otro medio",
};

/**
 * Cómo se le muestra el medio al socio.
 *
 * Un pago sin `method` pero con referencia del proveedor es de Mercado Pago: así los deja el
 * checkout, que crea el pago antes de saber con qué se abonó. Sin ninguna de las dos cosas no
 * se inventa nada — decir "efectivo" porque sí sería afirmar algo que no consta.
 */
export function paymentMethodLabel(input: {
  method: string | null;
  hasProviderRef: boolean;
}): string {
  const crudo = input.method;
  if (crudo === null || crudo.trim() === "") {
    return input.hasProviderRef ? "Mercado Pago" : "Sin especificar";
  }
  const medio = isHistoricalPayment(crudo) ? crudo.slice(HISTORICAL_PREFIX.length) : crudo;
  return ETIQUETAS[medio] ?? medio;
}
