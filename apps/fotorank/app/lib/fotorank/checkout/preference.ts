/**
 * Construcción del payload de preference (Checkout Pro).
 *
 * Función pura: recibe datos ya validados y devuelve el body exacto que se
 * envía a `POST /checkout/preferences`. Se mantiene separada del transporte
 * para poder verificarla sin red.
 *
 * Sin split: no lleva `marketplace_fee` ni receivers. El cobro va íntegro a la
 * cuenta dueña del access token.
 */

import { minorToWholeUnits } from "./money";

export type PreferenceItem = {
  id: string;
  title: string;
  description: string;
  category_id: string;
  quantity: number;
  currency_id: "ARS";
  unit_price: number;
};

export type PreferenceBody = {
  items: PreferenceItem[];
  external_reference: string;
  notification_url: string;
  back_urls: { success: string; failure: string; pending: string };
  auto_return: "approved";
  statement_descriptor: string;
  metadata: Record<string, string | number>;
  payer?: { email: string };
};

export type BuildPreferenceInput = {
  /** Identificador opaco de la inscripción. Nunca datos personales. */
  externalReference: string;
  contestId: string;
  contestTitle: string;
  /** Cantidad de fotografías del paquete elegido. */
  quantity: number;
  /** Precio TOTAL del paquete, en minor units, calculado por el servidor. */
  totalAmountMinor: number;
  /** Etapa de precio vigente, para trazabilidad. */
  pricePhaseCode: string;
  participantUserId: number;
  participantEmail?: string | null;
  publicUrl: string;
};

/** Máximo razonable para el descriptor en el resumen de tarjeta. */
const STATEMENT_DESCRIPTOR = "FOTORANK";

/**
 * El paquete se envía como **una sola línea** cuyo `unit_price` es el total y
 * `quantity` es 1.
 *
 * Es deliberado: "3 fotografías por ARS 100.000" no equivale a 3 unidades de
 * ARS 33.333,33 — el paquete tiene precio propio y no es divisible. Enviarlo
 * como 3 × precio unitario introduciría redondeos y cobraría un importe
 * distinto al configurado.
 */
export function buildPreferenceBody(input: BuildPreferenceInput): PreferenceBody {
  const unitPrice = minorToWholeUnits(input.totalAmountMinor);
  const base = input.publicUrl.replace(/\/$/, "");
  const ref = encodeURIComponent(input.externalReference);

  const item: PreferenceItem = {
    id: `${input.contestId}:${input.quantity}`,
    title: `${input.contestTitle} — inscripción`,
    description:
      input.quantity === 1
        ? "Participación con 1 fotografía"
        : `Participación con ${input.quantity} fotografías`,
    // Bien intangible.
    category_id: "services",
    quantity: 1,
    currency_id: "ARS",
    unit_price: unitPrice,
  };

  return {
    items: [item],
    external_reference: input.externalReference,
    notification_url: `${base}/api/payments/mercadopago/webhook`,
    back_urls: {
      success: `${base}/concursos/pago/exito?ref=${ref}`,
      failure: `${base}/concursos/pago/error?ref=${ref}`,
      pending: `${base}/concursos/pago/pendiente?ref=${ref}`,
    },
    auto_return: "approved",
    statement_descriptor: STATEMENT_DESCRIPTOR,
    // Trazabilidad interna. Sin datos personales.
    metadata: {
      contest_id: input.contestId,
      participant_user_id: input.participantUserId,
      quantity: input.quantity,
      price_phase: input.pricePhaseCode,
      amount_minor: input.totalAmountMinor,
      product: "fotorank_contest_registration",
    },
    ...(input.participantEmail ? { payer: { email: input.participantEmail } } : {}),
  };
}

/**
 * Verifica que el body construido cobra exactamente lo que el servidor calculó.
 * Última barrera antes de enviar a MP.
 */
export function assertPreferenceChargesExpected(
  body: PreferenceBody,
  expectedMinor: number,
): void {
  const sum = body.items.reduce((acc, i) => acc + i.unit_price * i.quantity, 0);
  if (sum * 100 !== expectedMinor) {
    throw new Error(
      `PREFERENCE_AMOUNT_MISMATCH: la preference cobraría ${sum * 100} ` +
        `pero el servidor calculó ${expectedMinor}`,
    );
  }
}
