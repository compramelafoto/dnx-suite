import "server-only";

/**
 * Los correos de la tienda. En esta etapa son funciones VACÍAS con su firma definitiva: quien
 * acredita un pago ya las llama (después de confirmar la transacción, nunca adentro) y la
 * Tarea 10 las implementa sin tocar a los llamadores.
 *
 * Reciben ids, no datos personales: cada correo relee el pedido de la base con su `workspaceId`.
 */

export type StoreOrderEmailInput = { workspaceId: string; orderId: string };

/** Al comprador: "recibimos tu pago". */
export async function sendOrderPaidEmail(input: StoreOrderEmailInput): Promise<void> {
  void input;
}

/** A la institución: entró un pedido pagado para preparar. */
export async function sendNewOrderNotice(input: StoreOrderEmailInput): Promise<void> {
  void input;
}

/** A la institución: entró la plata pero no hay stock. Hay que reponer o devolver. */
export async function sendPaidNoStockAlert(input: StoreOrderEmailInput): Promise<void> {
  void input;
}

/** A la institución: el mismo pedido se pagó dos veces. El segundo pago hay que devolverlo. */
export async function sendDuplicatePaymentAlert(
  input: StoreOrderEmailInput & { providerPaymentId: string },
): Promise<void> {
  void input;
}

/** Al comprador: el pedido está listo para retirar. */
export async function sendOrderReadyEmail(input: StoreOrderEmailInput): Promise<void> {
  void input;
}
