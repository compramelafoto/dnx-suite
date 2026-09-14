/**
 * Cómo se interpreta un aviso de pago de Mercado Pago.
 *
 * Función pura y aparte de la ruta: los estados de Mercado Pago son varios y
 * confundir uno cambia si un evento se crea o no.
 */

export type PagoDeMercadoPago = {
  id: number | string;
  status: string;
  external_reference?: string | null;
};

export type Decision =
  | { accion: "PAGAR"; ordenId: string; mpPaymentId: string }
  | { accion: "FALLAR"; ordenId: string; mpPaymentId: string }
  | { accion: "DEVOLVER"; ordenId: string; mpPaymentId: string }
  | { accion: "ESPERAR" }
  | { accion: "IGNORAR"; motivo: string };

export function decidirDesdeElPago(pago: PagoDeMercadoPago): Decision {
  const ordenId = pago.external_reference?.trim();
  if (!ordenId) return { accion: "IGNORAR", motivo: "sin referencia de orden" };

  // Siempre texto: la base lo guarda así y la restricción de unicidad es lo
  // único que impide que un aviso repetido cree dos eventos.
  const mpPaymentId = String(pago.id);

  switch (pago.status) {
    case "approved":
      return { accion: "PAGAR", ordenId, mpPaymentId };

    case "rejected":
    case "cancelled":
      return { accion: "FALLAR", ordenId, mpPaymentId };

    case "refunded":
    case "charged_back":
      return { accion: "DEVOLVER", ordenId, mpPaymentId };

    // Todavía no se resolvió. Va a llegar otro aviso; adelantarse sería marcar
    // como fallido algo que la mayoría de las veces termina aprobado.
    case "pending":
    case "in_process":
    case "authorized":
      return { accion: "ESPERAR" };

    default:
      // Mercado Pago puede agregar estados. Adivinar qué significa uno nuevo es
      // peor que no hacer nada.
      return { accion: "IGNORAR", motivo: `estado desconocido: ${pago.status}` };
  }
}
