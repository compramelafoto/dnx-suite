import type { MarcaPiloto } from "./snapshot";

export type DecisionPlanB =
  | "pasar"
  | "ya_elegido"
  | "split_en_curso"
  | "cobro_en_curso"
  | "ya_pagado"
  | "no_es_piloto";

/**
 * ¿Un pedido del piloto puede pasar a Checkout Pro («Pagar con Mercado Pago»)?
 *
 * Sólo desde `PENDIENTE`: ningún pedido a Mercado Pago está en curso (un intento rechazado
 * vuelve a `PENDIENTE` con la orden rechazada, que no cobra). En `COBRANDO` o `EN_REVISION`
 * el resultado del cobro con tarjeta es incierto: ofrecer otro medio sería cobrar dos veces.
 */
export function decidirPlanB(params: { estadoPedido: string; marca: MarcaPiloto | null }): DecisionPlanB {
  if (!params.marca) return "no_es_piloto";
  if (params.estadoPedido !== "PENDING" && params.estadoPedido !== "FAILED") return "ya_pagado";
  if (params.marca.estado === "CHECKOUT_PRO") return "ya_elegido";
  // Hay (o puede haber) un enlace de Checkout Pro con reparto: lo maneja `plan-b-split.ts`.
  if (params.marca.estado === "CHECKOUT_SPLIT") return "split_en_curso";
  if (params.marca.estado === "PENDIENTE") return "pasar";
  return "cobro_en_curso";
}
