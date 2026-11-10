import {
  buildSplitEntriesFromDistribution,
  moneyToMercadoPagoAmount,
} from "@repo/payments/mercado-pago";
import type { CobroPreparado } from "./cobro";
import { referenciaPedido } from "./decidir";

/**
 * Checkout Pro sobre la API de Orders, con reparto 1:N: el comprador paga en Mercado Pago con
 * cualquier medio (también dinero en cuenta) y Mercado Pago reparte en el momento, igual que
 * con la tarjeta. Verificado en producción el 10/11/2026: Mercado Pago acepta `splits` en una
 * orden `processing_mode: manual` y devuelve un `checkout_url`.
 *
 * Sin `transactions` ni token: la orden sola no cobra nada; cobra recién cuando el comprador
 * paga en el `checkout_url`.
 */
export type OrdenCheckoutSplit = {
  type: "online";
  processing_mode: "manual";
  total_amount: string;
  external_reference: string;
  expiration_time: string;
  description: string;
  payer: { email: string };
  items: Array<{ title: string; unit_price: string; quantity: number }>;
  splits: Array<{ receiver_id: string; receiver_type: "owner" | "partner"; amount: string; description: string }>;
  config: {
    split_rules: { amount_type: "fixed" };
    online: { success_url: string; failure_url: string; pending_url: string; auto_return: "approved" };
  };
};

/** Vigencia de la orden: después vence y, si el comprador vuelve, se crea otra. */
export const VIGENCIA_ORDEN_CHECKOUT_SPLIT = "P1D";

/**
 * Arma la orden con la misma distribución que cobra la tarjeta (`prepararCobro`): mismos
 * montos fijos, misma plataforma como `owner`, misma referencia de pedido. Lanza si la suma de
 * los repartos no da el total (nunca debería pasar: lo garantiza `prepararCobro`).
 */
export function armarOrdenCheckoutSplit(params: {
  pedidoId: number;
  cobro: Extract<CobroPreparado, { ok: true }>;
  ownerUserId: string;
  titulo: string;
  payerEmail: string;
  baseUrl: string;
}): OrdenCheckoutSplit {
  const { cobro } = params;
  const entries = buildSplitEntriesFromDistribution(cobro.distribution, params.ownerUserId, cobro.partnerReceiverIds, {
    partnerConsentsByRecipientId: new Map(
      [...cobro.partnerReceiverIds.entries()].map(([recipientId, receiverId]) => [
        recipientId,
        { receiverId, status: "ACTIVE" as const, provider: "mercadopago" as const },
      ]),
    ),
    amountType: "fixed",
  });
  let suma = 0n;
  const splits = entries.map((e) => {
    if (!e.amount) throw new Error("CHECKOUT_SPLIT_SIN_MONTO");
    suma += e.amount.amountMinor;
    return {
      receiver_id: e.receiverId,
      receiver_type: e.receiverType,
      amount: moneyToMercadoPagoAmount(e.amount),
      description: e.receiverType === "owner" ? "owner" : "partner",
    };
  });
  if (suma !== cobro.total.amountMinor) throw new Error("CHECKOUT_SPLIT_SUMA_DISTINTA");

  const total = moneyToMercadoPagoAmount(cobro.total);
  const volver = `${params.baseUrl.replace(/\/+$/, "")}/pagar/${params.pedidoId}`;
  return {
    type: "online",
    processing_mode: "manual",
    total_amount: total,
    external_reference: referenciaPedido(params.pedidoId),
    expiration_time: VIGENCIA_ORDEN_CHECKOUT_SPLIT,
    description: params.titulo,
    payer: { email: params.payerEmail },
    items: [{ title: params.titulo, unit_price: total, quantity: 1 }],
    splits,
    config: {
      split_rules: { amount_type: "fixed" },
      online: { success_url: volver, failure_url: volver, pending_url: volver, auto_return: "approved" },
    },
  };
}

export type DecisionOrdenCheckoutSplit = "reusar" | "confirmar" | "nueva";

/**
 * Qué hacer con la orden vigente cuando el comprador vuelve a tocar el botón. Sólo una orden
 * terminada sin pago (vencida, cancelada o rechazada) habilita otra: ante la duda se reutiliza,
 * así nunca hay dos enlaces de pago vivos para el mismo pedido.
 */
export function decidirOrdenCheckoutSplit(status: string | null | undefined): DecisionOrdenCheckoutSplit {
  const s = (status ?? "").toLowerCase();
  if (s === "processed") return "confirmar";
  if (s === "canceled" || s === "cancelled" || s === "expired" || s === "failed") return "nueva";
  return "reusar";
}
