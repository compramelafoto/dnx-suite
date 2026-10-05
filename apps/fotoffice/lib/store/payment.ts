import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, type StoreOrderStatus } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { appUrl } from "@/lib/app-url";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { feeForBooking } from "@/lib/platform-fee/ledger-booking";
import { pendingFeeDebtMinor } from "@/lib/platform-fee/ledger";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { STORE_MODULE_KEY } from "./constants";
import { storeExternalReference } from "./external-reference";

/**
 * El cobro de un pedido de la tienda. Es el MISMO circuito que las reservas
 * (`lib/bookings/checkout.ts`): Checkout Pro con el token de la institución y `marketplace_fee`
 * retenido en la misma operación; el dinero no pasa por DNX. La comisión sigue el mismo criterio
 * (propia + deuda arrastrada) y se congela en el pedido ANTES de ir a Mercado Pago, una sola vez.
 *
 * Con envío, Mercado Pago cobra el total (productos + envío), pero la comisión se calcula sobre
 * los productos solamente (E11): el envío es plata que va al correo.
 *
 * El webhook es propio (`/api/payments/mp/tienda-webhook`) por el mismo motivo que el de reservas:
 * un error de la tienda no puede romper el cobro de las cuotas.
 */

// ── Reglas puras (probadas en payment.test.ts) ─────────────────────────────

export function storePaymentDescription(storeName: string, orderNumber: number, withShipping = false): string {
  return `Compra en ${storeName} — pedido #${orderNumber}${withShipping ? " (incluye envío)" : ""}`;
}

/** Las tres vueltas de Mercado Pago. `returnPath` puede traer ya parámetros (el token del pedido). */
export function storeReturnUrls(
  base: string,
  returnPath: string,
): { successUrl: string; pendingUrl: string; failureUrl: string } {
  const sep = returnPath.includes("?") ? "&" : "?";
  const url = (pago: string) => `${base}${returnPath}${sep}pago=${pago}`;
  return { successUrl: url("ok"), pendingUrl: url("pendiente"), failureUrl: url("error") };
}

/** Por qué un pedido no se puede mandar a pagar, o `null` si se puede. */
export function storeCheckoutBlocker(
  order: { status: StoreOrderStatus; holdExpiresAt: Date | null; totalMinor: number },
  now: Date,
): string | null {
  if (order.status !== "PENDING_PAYMENT") return "Ese pedido ya no está esperando el pago.";
  // Vencida la retención, el stock ya se liberó para otros: pagar ahora podría cobrar algo que no hay.
  if (!order.holdExpiresAt || order.holdExpiresAt.getTime() <= now.getTime()) {
    return "La reserva de tu pedido venció. Volvé al carrito para empezar de nuevo.";
  }
  if (order.totalMinor <= 0) return "Ese pedido no tiene nada que pagar.";
  return null;
}

// ── Con base y red ──────────────────────────────────────────────────────────

export type StoreCheckoutResult = { ok: true; checkoutUrl: string } | { ok: false; error: string };

export async function startStoreCheckout(input: {
  workspaceId: string;
  orderId: string;
  /** A dónde vuelve la persona después de pagar. Path interno; puede traer parámetros. */
  returnPath: string;
  now?: Date;
}): Promise<StoreCheckoutResult> {
  const pedido = await prisma.storeOrder.findFirst({
    where: { id: input.orderId, workspaceId: input.workspaceId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      holdExpiresAt: true,
      subtotalArs: true,
      shippingArs: true,
      totalArs: true,
      buyerEmail: true,
      feeBps: true,
      feeArs: true,
      mpPreferenceId: true,
      workspace: { select: { name: true, fotofficeBranding: { select: { commercialName: true } } } },
    },
  });
  if (!pedido) return { ok: false, error: "No encontramos ese pedido." };

  const totalMinor = decimalArsToMinor(pedido.totalArs);
  const bloqueo = storeCheckoutBlocker(
    { status: pedido.status, holdExpiresAt: pedido.holdExpiresAt, totalMinor },
    input.now ?? new Date(),
  );
  if (bloqueo) return { ok: false, error: bloqueo };

  const base = appUrl();
  if (!base) return { ok: false, error: "Falta configurar la dirección pública de la aplicación." };

  const collector = await resolveWorkspaceCollector(input.workspaceId);
  if (!collector.ok) {
    // El mensaje habla de la institución, no de quien compra: no puede resolverlo.
    return { ok: false, error: "La institución todavía no tiene los cobros habilitados. Escribile a la institución." };
  }

  // La comisión se congela UNA vez por pedido. Si ya se abrió un pago antes (hay preferencia),
  // esa preferencia puede seguir pagable con lo que se retuvo entonces: la nueva retiene lo mismo
  // y no se recalcula con la deuda de este momento (si no, lo congelado no coincidiría con lo
  // retenido por una de las dos).
  const congelada = pedido.mpPreferenceId !== null;
  let feeBps: number;
  let withholdMinor: number;
  if (congelada) {
    feeBps = pedido.feeBps;
    withholdMinor = decimalArsToMinor(pedido.feeArs);
  } else {
    feeBps = await getPlatformFeeBps(input.workspaceId, STORE_MODULE_KEY);
    const deuda = await pendingFeeDebtMinor(input.workspaceId);
    // Sobre los productos (E11): ni la comisión ni la deuda arrastrada salen del envío.
    const subtotalMinor = decimalArsToMinor(pedido.subtotalArs);
    withholdMinor = feeForBooking({ totalMinor: subtotalMinor, feeBps, pendingDebtMinor: deuda }).withholdMinor;
  }

  // Se escribe ANTES de ir a Mercado Pago y SÓLO si sigue esperando el pago: si en el medio se
  // acreditó, venció o se canceló, no se abre otro pago.
  const escrito = await prisma.storeOrder.updateMany({
    where: { id: pedido.id, workspaceId: input.workspaceId, status: "PENDING_PAYMENT" },
    data: { feeBps, feeArs: minorToDecimalString(withholdMinor) },
  });
  if (escrito.count === 0) return { ok: false, error: "Ese pedido ya no está esperando el pago." };

  const nombre = pedido.workspace.fotofficeBranding?.commercialName ?? pedido.workspace.name;

  try {
    const adapter = createMercadoPagoCheckoutProLiveAdapter({});
    const preferencia = await adapter.createPreference({
      amountMinor: totalMinor,
      currency: "ARS",
      description: storePaymentDescription(nombre, pedido.orderNumber, decimalArsToMinor(pedido.shippingArs) > 0),
      externalReference: storeExternalReference(pedido.id),
      idempotencyKey: randomUUID(),
      ...storeReturnUrls(base, input.returnPath),
      notificationUrl: `${base}/api/payments/mp/tienda-webhook`,
      accessTokenOverride: collector.collector.accessToken,
      marketplaceFeeMinor: withholdMinor,
      itemId: `pedido-${pedido.id}`,
      sourceApp: "FOTOFFICE",
      metadata: { storeOrderId: pedido.id, workspaceId: input.workspaceId },
      payerEmail: pedido.buyerEmail,
    });

    await prisma.storeOrder.updateMany({
      where: { id: pedido.id, workspaceId: input.workspaceId },
      data: { mpPreferenceId: preferencia.providerPreferenceId },
    });

    return { ok: true, checkoutUrl: preferencia.checkoutUrl };
  } catch (error) {
    console.error("[fotoffice][tienda] MercadoPago rechazó la preferencia", {
      storeOrderId: pedido.id,
      detalle: sanitizeError(error),
    });
    return { ok: false, error: "No pudimos abrir el pago. Probá de nuevo en unos minutos." };
  }
}
