"use server";

import { revalidatePath } from "next/cache";
import type { StoreOrderStatus } from "@repo/db";
import { requireStoreOperator } from "@/lib/store/access";
import { resolveOriginalDownload, type OriginalDownloadResult } from "@/lib/store/artworks/production";
import { changeOrderStatus, markOrderReviewed, type OrderAdminResult } from "@/lib/store/order-admin";

/**
 * Las acciones del detalle de un pedido online. El permiso y el workspace salen SIEMPRE de la
 * sesión (`requireStoreOperator`), nunca del formulario. Devuelven un resultado: la nota que
 * escribió la persona no se pierde si algo sale mal.
 */

const DESTINOS: readonly StoreOrderStatus[] = ["PAID", "READY", "SHIPPED", "DELIVERED", "CANCELLED"];

function refrescar(orderId: string) {
  revalidatePath("/ventas/tienda");
  revalidatePath(`/ventas/tienda/${orderId}`);
  revalidatePath("/ventas/historial");
  revalidatePath("/ventas/stock");
}

export async function changeOrderStatusAction(input: {
  orderId: string;
  to: string;
  note: string;
  trackingNumber?: string;
}): Promise<OrderAdminResult> {
  const { workspace, user } = await requireStoreOperator();
  const to = DESTINOS.find((d) => d === input.to);
  if (!to) return { ok: false, error: "Ese cambio no se puede hacer desde el panel." };

  const r = await changeOrderStatus({
    workspaceId: workspace.id,
    orderId: String(input.orderId),
    to,
    userId: user.id,
    note: typeof input.note === "string" ? input.note : null,
    trackingNumber: typeof input.trackingNumber === "string" ? input.trackingNumber : null,
  });
  if (r.ok) refrescar(input.orderId);
  return r;
}

export async function markOrderReviewedAction(input: { orderId: string; note: string }): Promise<OrderAdminResult> {
  const { workspace, user } = await requireStoreOperator();
  const r = await markOrderReviewed({
    workspaceId: workspace.id,
    orderId: String(input.orderId),
    userId: user.id,
    note: typeof input.note === "string" ? input.note : null,
  });
  if (r.ok) refrescar(input.orderId);
  return r;
}

/**
 * Enlace firmado (10 minutos) al original de una obra para imprimirla. Firmar es autorizar:
 * `resolveOriginalDownload` verifica workspace, estado del pedido y renglón. El navegador
 * recibe el enlace y navega; no se guarda en ningún lado.
 */
export async function downloadArtworkOriginalAction(input: {
  orderId: string;
  itemId: string;
}): Promise<OriginalDownloadResult> {
  const { workspace } = await requireStoreOperator();
  return resolveOriginalDownload({
    workspaceId: workspace.id,
    orderId: String(input.orderId),
    itemId: String(input.itemId),
  });
}
