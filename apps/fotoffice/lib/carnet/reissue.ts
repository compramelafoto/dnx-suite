/**
 * ¿Se le ofrece pedir —o volver a pedir— la tarjeta impresa?
 *
 * Hasta ahora la sección aparecía solo si nunca había tenido una: entregada la primera, el
 * botón no volvía nunca. Pero un socio cambia de categoría, se muda, se le vence la
 * credencial o simplemente la pierde, y en todos esos casos necesita otra.
 *
 * Cada reemisión se cobra: es una tarjeta nueva, con su costo.
 *
 * Función pura: decide si se le cobra algo, así que tiene que poder probarse.
 */

export type FulfillmentState =
  | "PENDIENTE_PAGO"
  | "EN_COLA"
  | "IMPRESO"
  | "LISTO_PARA_RETIRAR"
  | "ENVIADO"
  | "ENTREGADO"
  | "ANULADO";

/** Estados en los que la tarjeta está en camino: pedir otra sería pagar dos veces lo mismo. */
const EN_CURSO: ReadonlySet<FulfillmentState> = new Set([
  "PENDIENTE_PAGO",
  "EN_COLA",
  "IMPRESO",
  "LISTO_PARA_RETIRAR",
  "ENVIADO",
]);

export type PrintedCardOffer =
  | { ofrecer: false }
  | { ofrecer: true; motivo: "PRIMERA" | "REEMISION" };

export function printedCardOffer(input: {
  /** Estado de la última tarjeta impresa no revocada. `null` si nunca tuvo. */
  state: FulfillmentState | null;
  /** Hasta cuándo vale esa tarjeta. */
  validUntil: Date | null;
  now: Date;
}): PrintedCardOffer {
  if (!input.state) return { ofrecer: true, motivo: "PRIMERA" };

  // Una vencida ya no sirve, esté en el estado que esté: un trámite que quedó a mitad de
  // camino hace dos años no puede bloquear a nadie para siempre.
  const vencida = input.validUntil !== null && input.validUntil.getTime() <= input.now.getTime();
  if (vencida) return { ofrecer: true, motivo: "REEMISION" };

  if (EN_CURSO.has(input.state)) return { ofrecer: false };

  // Entregada o anulada: el trámite terminó y puede empezar otro.
  return { ofrecer: true, motivo: "REEMISION" };
}
