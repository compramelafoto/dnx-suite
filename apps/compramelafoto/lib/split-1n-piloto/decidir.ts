/** Prefijo de `external_reference` de las órdenes del piloto: identifica el pedido de CLF. */
export const PREFIJO_REFERENCIA = "clf-album-order-";

export function referenciaPedido(pedidoId: number): string {
  return `${PREFIJO_REFERENCIA}${pedidoId}`;
}

export function pedidoIdDesdeReferencia(ref: string | null | undefined): number | null {
  if (!ref || !ref.startsWith(PREFIJO_REFERENCIA)) return null;
  const n = Number(ref.slice(PREFIJO_REFERENCIA.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

export type DecisionFinalizacion = "aplicar" | "ya_pagado" | "no_acreditada" | "referencia_distinta";

/**
 * Con qué se confirma un pedido del piloto: la orden leída por GET en Mercado Pago, nunca lo
 * que diga el navegador o el cuerpo de un aviso. Lo pagado no se vuelve a aplicar, así la
 * página y el webhook pueden llegar los dos sin duplicar la entrega.
 */
export function decidirFinalizacion(params: {
  estadoPedido: string;
  mpStatus: string | null | undefined;
  mpStatusDetail: string | null | undefined;
  refPedidoId: number | null;
  pedidoId: number;
}): DecisionFinalizacion {
  if (params.refPedidoId !== params.pedidoId) return "referencia_distinta";
  if (params.estadoPedido === "PAID") return "ya_pagado";
  const acreditada =
    params.mpStatus?.toLowerCase() === "processed" &&
    params.mpStatusDetail?.toLowerCase() === "accredited";
  if (!acreditada) return "no_acreditada";
  return params.estadoPedido === "PENDING" || params.estadoPedido === "FAILED"
    ? "aplicar"
    : "no_acreditada";
}
