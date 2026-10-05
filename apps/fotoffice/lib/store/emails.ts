import "server-only";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { decimalArsToMinor } from "@/lib/membership/money";
import { orderAccessToken, resolveOrderTokenKey } from "./access-token";
import { orderShippingView } from "./shipping/order-destination";
import {
  buildStoreOrderUrl,
  renderCreditFailureAlert,
  renderDuplicatePaymentAlert,
  renderNewOrderNotice,
  renderOrderPaid,
  renderOrderReady,
  renderPaidNoStockAlert,
  renderRegretNotice,
  type RenderedEmail,
  type StoreEmailOrder,
} from "./email-render";

/**
 * Los correos de la tienda. Quien acredita un pago o cambia un estado los llama DESPUÉS de
 * confirmar la transacción, nunca adentro.
 *
 * Reciben ids, no datos personales: cada correo relee el pedido de la base con su `workspaceId`.
 * **Nunca lanzan**: el pedido ya cambió y un correo que no sale no lo puede deshacer. Los textos
 * viven en `email-render.ts` (funciones puras, probadas).
 */

export type StoreOrderEmailInput = { workspaceId: string; orderId: string };

type Cargado = { order: StoreEmailOrder; publicId: string; buyerEmail: string; notifyEmail: string | null };

async function cargar(input: StoreOrderEmailInput): Promise<Cargado | null> {
  const order = await prisma.storeOrder.findFirst({
    where: { id: input.orderId, workspaceId: input.workspaceId },
    select: {
      id: true,
      publicId: true,
      orderNumber: true,
      buyerName: true,
      buyerEmail: true,
      buyerPhone: true,
      totalArs: true,
      deliveryMethod: true,
      shippingMethod: true,
      shippingArs: true,
      shippingAddressJson: true,
      shippingAgencyJson: true,
      items: {
        orderBy: { id: "asc" },
        select: { productName: true, variantName: true, qty: true, lineTotalArs: true },
      },
    },
  });
  if (!order) return null;

  const [settings, workspace, dominio] = await Promise.all([
    prisma.storeSettings.findUnique({
      where: { workspaceId: input.workspaceId },
      select: { pickupAddress: true, pickupHours: true, pickupInstructions: true, notifyEmail: true },
    }),
    prisma.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { name: true, fotofficeBranding: { select: { publicSlug: true, commercialName: true } } },
    }),
    prisma.fotofficeWorkspaceDomain.findUnique({
      where: { workspaceId: input.workspaceId },
      select: { domain: true, status: true },
    }),
  ]);

  const origen = appUrl();
  const clave = resolveOrderTokenKey();
  const destino = orderShippingView(order);
  return {
    publicId: order.publicId,
    buyerEmail: order.buyerEmail,
    notifyEmail: settings?.notifyEmail?.trim() || null,
    order: {
      institution: workspace?.fotofficeBranding?.commercialName || workspace?.name || "La tienda",
      orderNumber: order.orderNumber,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      buyerPhone: order.buyerPhone,
      totalMinor: decimalArsToMinor(order.totalArs),
      items: order.items.map((i) => ({
        description: i.productName + (i.variantName ? ` — ${i.variantName}` : ""),
        qty: i.qty,
        lineTotalMinor: decimalArsToMinor(i.lineTotalArs),
      })),
      pickup: {
        address: settings?.pickupAddress ?? null,
        hours: settings?.pickupHours ?? null,
        instructions: settings?.pickupInstructions ?? null,
      },
      shipping: destino
        ? { label: destino.label, amountMinor: decimalArsToMinor(order.shippingArs), lines: destino.lines }
        : null,
      // El mismo token que se dio al crear el pedido (es determinista): no invalida la cookie.
      orderUrl: buildStoreOrderUrl({
        customDomain: dominio?.status === "CONNECTED" ? dominio.domain : null,
        appOrigin: origen,
        slug: workspace?.fotofficeBranding?.publicSlug ?? null,
        publicId: order.publicId,
        token: clave ? orderAccessToken(order.publicId, clave) : null,
      }),
      panelUrl: origen ? `${origen}/ventas/tienda/${order.id}` : null,
    },
  };
}

type Destino = "comprador" | "institucion";

async function enviar(
  input: StoreOrderEmailInput,
  templateKey: string,
  destino: Destino,
  render: (o: StoreEmailOrder, datos: Cargado) => RenderedEmail,
): Promise<void> {
  try {
    const datos = await cargar(input);
    if (!datos) return;
    const to = destino === "comprador" ? datos.buyerEmail : datos.notifyEmail;
    if (!to) {
      // Sin datos personales: qué aviso y de qué pedido.
      console.warn("[fotoffice][tienda] aviso sin enviar: la tienda no tiene email de avisos", {
        templateKey,
        storeOrderId: input.orderId,
      });
      return;
    }
    await sendAndLogEmail({ to, templateKey, body: render(datos.order, datos) });
  } catch (error) {
    console.error("[fotoffice][tienda] no se pudo armar un correo", {
      templateKey,
      storeOrderId: input.orderId,
      detalle: error instanceof Error ? error.name : "desconocido",
    });
  }
}

/** Al comprador: "recibimos tu pago". */
export async function sendOrderPaidEmail(input: StoreOrderEmailInput): Promise<void> {
  await enviar(input, "store.order_paid", "comprador", renderOrderPaid);
}

/** A la institución: entró un pedido pagado para preparar. */
export async function sendNewOrderNotice(input: StoreOrderEmailInput): Promise<void> {
  await enviar(input, "store.new_order", "institucion", renderNewOrderNotice);
}

/** A la institución: entró la plata pero no hay stock. Hay que reponer o devolver. */
export async function sendPaidNoStockAlert(input: StoreOrderEmailInput): Promise<void> {
  await enviar(input, "store.paid_no_stock", "institucion", renderPaidNoStockAlert);
}

/** A la institución: el mismo pedido se pagó dos veces. El segundo pago hay que devolverlo. */
export async function sendDuplicatePaymentAlert(
  input: StoreOrderEmailInput & { providerPaymentId: string },
): Promise<void> {
  await enviar(input, "store.duplicate_payment", "institucion", (o) =>
    renderDuplicatePaymentAlert(o, input.providerPaymentId),
  );
}

/** A la institución: Mercado Pago aprobó un pago que no se pudo acreditar. Hay que revisarlo. */
export async function sendCreditFailureAlert(input: StoreOrderEmailInput): Promise<void> {
  await enviar(input, "store.credit_failure", "institucion", renderCreditFailureAlert);
}

/** Al comprador: el pedido está listo para retirar. */
export async function sendOrderReadyEmail(input: StoreOrderEmailInput): Promise<void> {
  await enviar(input, "store.order_ready", "comprador", renderOrderReady);
}

/**
 * A la institución: alguien usó el botón de arrepentimiento. El código del trámite es el
 * `publicId` en mayúsculas, el mismo que vio quien compró (ver `regret.ts`).
 */
export async function sendRegretNotice(input: StoreOrderEmailInput & { reason: string | null }): Promise<void> {
  await enviar(input, "store.regret", "institucion", (o, datos) =>
    renderRegretNotice(o, { code: datos.publicId.toUpperCase(), reason: input.reason }),
  );
}
