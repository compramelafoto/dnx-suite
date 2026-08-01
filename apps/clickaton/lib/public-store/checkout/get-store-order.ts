import "server-only";

import { prisma } from "@repo/db";
import {
  hashStoreOrderAccessToken,
  maskEmail,
  maskPhone,
} from "./access-token";
import { StoreCheckoutError } from "./errors";
import type { PublicStoreOrderView, StoreDeliveryData } from "./types";

function deliverySummary(data: unknown, method: string): string {
  if (!data || typeof data !== "object") return method;
  const d = data as StoreDeliveryData;
  if (d.kind === "PICKUP") {
    return `Retiro: ${d.pickupPointLabel} (retira ${d.pickupPersonName})`;
  }
  return `Envío a ${d.city}, ${d.province}`;
}

export async function getPublicStoreOrder(input: {
  publicId: string;
  accessToken: string | null;
}): Promise<PublicStoreOrderView> {
  if (!input.publicId.startsWith("sto_") || input.publicId.length < 20) {
    throw new StoreCheckoutError("ORDER_NOT_FOUND", "Pedido no encontrado.", 404);
  }
  if (!input.accessToken || input.accessToken.length < 16) {
    throw new StoreCheckoutError("ACCESS_DENIED", "Acceso denegado.", 403);
  }

  const order = await prisma.clickatonStoreOrder.findUnique({
    where: { publicId: input.publicId },
    include: { items: true },
  });
  if (!order) {
    throw new StoreCheckoutError("ORDER_NOT_FOUND", "Pedido no encontrado.", 404);
  }

  const hash = hashStoreOrderAccessToken(input.accessToken);
  if (hash !== order.accessTokenHash) {
    throw new StoreCheckoutError("ACCESS_DENIED", "Acceso denegado.", 403);
  }

  const holdActive =
    order.status === "PENDING_PAYMENT" &&
    order.holdExpiresAt != null &&
    order.holdExpiresAt.getTime() > Date.now() &&
    order.paymentStatus !== "APPROVED";

  return {
    publicId: order.publicId,
    createdAt: order.createdAt.toISOString(),
    status: order.status,
    paymentStatus: order.paymentStatus,
    currency: order.currency,
    subtotalAmount: order.subtotalAmount,
    deliveryAmount: order.deliveryAmount,
    totalAmount: order.totalAmount,
    deliveryMethod: order.deliveryMethod,
    deliverySummary: deliverySummary(order.deliveryData, order.deliveryMethod),
    customer: {
      firstName: order.customerFirstName,
      lastName: order.customerLastName,
      emailMasked: maskEmail(order.customerEmail),
      phoneMasked: maskPhone(order.customerPhone),
    },
    items: order.items.map((i) => ({
      productName: i.productNameSnapshot,
      variantName: i.variantNameSnapshot,
      quantity: i.quantity,
      unitPriceAmount: i.unitPriceAmount,
      lineSubtotalAmount: i.lineSubtotalAmount,
      currency: i.currency,
      imageUrl: i.imageUrlSnapshot,
    })),
    holdExpiresAt: order.holdExpiresAt?.toISOString() ?? null,
    canRetryPayment: holdActive,
    operationalNotes: [
      "El estado de pago se confirma por notificación del proveedor, no por esta pantalla sola.",
      "Textos legales de compra: pendientes de revisión legal antes de producción.",
    ],
    legalVersion: order.legalVersion,
    commercialFingerprint: order.commercialFingerprint,
  };
}
