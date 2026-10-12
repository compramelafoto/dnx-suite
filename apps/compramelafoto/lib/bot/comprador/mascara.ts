/** Mail enmascarado para mostrar en el chat: nunca el mail completo ("ju***@gmail.com"). */
export function enmascararEmail(email: string | null | undefined): string {
  const limpio = (email ?? "").trim().toLowerCase();
  const arroba = limpio.indexOf("@");
  if (arroba < 1 || arroba === limpio.length - 1) return "tu mail";
  return `${limpio.slice(0, Math.min(2, arroba))}***${limpio.slice(arroba)}`;
}

const ETIQUETAS_ESTADO: Record<string, string> = {
  PAID: "pagado",
  PENDING: "pendiente de pago",
  FAILED: "rechazado",
  CANCELED: "cancelado",
  REFUNDED: "devuelto",
};

/** Estado del pedido en palabras para la persona que compró. */
export function etiquetaEstadoPedido(status: string): string {
  return ETIQUETAS_ESTADO[status] ?? "en revisión";
}
