/**
 * Reglas puras para detectar un cobro duplicado sobre un pedido de álbum.
 *
 * Caso real (11/10/2026): el pedido 4645 ya estaba PAID y el comprador pagó otra vez la
 * misma preferencia de Mercado Pago (pago 183660994910). El sistema lo ignoraba en silencio
 * ("already_paid") y nadie se enteraba de que había que devolver la plata.
 */

export type ApprovedPaymentOnOrderKind =
  /** El pedido todavía no está pagado: es el pago normal. */
  | "first_payment"
  /** Llega otra vez el mismo pago (reintento de webhook, pantalla de éxito). */
  | "same_payment"
  /** Pedido PAID sin pago de MP registrado (p. ej. cubierto por un canje): no se puede comparar. */
  | "paid_without_mp_payment"
  /** Pedido PAID con OTRO pago de MP: cobro duplicado. */
  | "duplicate_payment";

export function classifyApprovedPaymentOnAlbumOrder(
  order: { status: string; mpPaymentId: string | null | undefined },
  incomingPaymentId: string | number
): ApprovedPaymentOnOrderKind {
  if (order.status !== "PAID") return "first_payment";
  const original = String(order.mpPaymentId ?? "").trim();
  const incoming = String(incomingPaymentId ?? "").trim();
  if (!original) return "paid_without_mp_payment";
  if (!incoming || incoming === original) return "same_payment";
  return "duplicate_payment";
}

/** Claves de idempotencia de los avisos: uno por pedido + pago duplicado, aunque MP reintente. */
export function duplicatePaymentEmailIdempotencyKey(
  recipient: "admin" | "photographer",
  orderId: number,
  paymentId: string
): string {
  return `duplicate_payment_${recipient}_${orderId}_${paymentId}`;
}

function formatPesos(pesos: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(pesos);
}

export type DuplicatePaymentEmailInput = {
  orderId: number;
  albumTitle: string | null;
  buyerName: string | null;
  buyerEmail: string;
  buyerPhone: string | null;
  originalPaymentId: string;
  duplicatePaymentId: string;
  /** Monto del pago duplicado, en pesos. */
  amountPesos: number | null;
  /** Fecha de aprobación ya formateada en hora argentina. */
  approvedAtLabel: string | null;
};

export function buildDuplicatePaymentEmail(
  recipient: "admin" | "photographer",
  input: DuplicatePaymentEmailInput,
  photographerName?: string | null
): { subject: string; body: string } {
  const amount =
    input.amountPesos != null && Number.isFinite(input.amountPesos)
      ? formatPesos(input.amountPesos)
      : "(monto no disponible)";
  const buyer = [
    input.buyerName ? `Nombre: ${input.buyerName}` : null,
    `Email: ${input.buyerEmail}`,
    input.buyerPhone ? `WhatsApp / teléfono: ${input.buyerPhone}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const album = input.albumTitle ? ` del álbum "${input.albumTitle}"` : "";
  const details =
    `Pedido: #${input.orderId}${album}\n` +
    `Pago del pedido (el que quedó registrado): ${input.originalPaymentId}\n` +
    `Segundo pago: ${input.duplicatePaymentId}\n` +
    `Monto del segundo pago: ${amount}\n` +
    (input.approvedAtLabel ? `Aprobado: ${input.approvedAtLabel}\n` : "") +
    `\nComprador:\n${buyer}`;

  if (recipient === "admin") {
    return {
      subject: `[Segundo pago] Pedido #${input.orderId}: entró otro pago sobre un pedido ya pagado`,
      body:
        `Mercado Pago aprobó un segundo pago sobre un pedido que ya estaba pagado.\n` +
        `Puede ser una compra nueva: el cliente pudo haber elegido otras fotos y el pago quedó ` +
        `pegado al pedido anterior. El sistema no lo aplicó a ningún pedido ni lo devolvió.\n\n` +
        `${details}\n\n` +
        `Qué hacer: contactar al cliente para saber qué fotos eligió y armarle el pedido con ese pago. ` +
        `Solo si de verdad pagó dos veces lo mismo, devolverlo desde Mercado Pago ` +
        `(verificando que el pedido original siga en PAID).`,
    };
  }
  return {
    subject: `Entró un segundo pago del pedido #${input.orderId}`,
    body:
      `Hola ${photographerName || "fotógrafo/a"},\n\n` +
      `El pedido #${input.orderId}${album} ya estaba pagado y Mercado Pago aprobó un segundo pago del mismo cliente. ` +
      `Puede ser una compra nueva: es posible que haya elegido otras fotos y que el pago haya quedado ` +
      `pegado al pedido anterior.\n\n` +
      `${details}\n\n` +
      `Te recomendamos contactar al cliente para saber qué fotos eligió. ` +
      `Nosotros también estamos al tanto y te ayudamos a armarle el pedido.\n\n` +
      `Saludos,\nComprameLaFoto`,
  };
}
