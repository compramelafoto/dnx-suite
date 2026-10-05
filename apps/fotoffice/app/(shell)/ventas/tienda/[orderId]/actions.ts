"use server";

import { revalidatePath } from "next/cache";
import type { StoreOrderStatus } from "@repo/db";
import { requireStoreOperator } from "@/lib/store/access";
import { changeOrderStatus, markOrderReviewed, type OrderAdminResult } from "@/lib/store/order-admin";

/**
 * Las acciones del detalle de un pedido online. El permiso y el workspace salen SIEMPRE de la
 * sesión (`requireStoreOperator`), nunca del formulario. Devuelven un resultado: la nota que
 * escribió la persona no se pierde si algo sale mal.
 */

const DESTINOS: readonly StoreOrderStatus[] = ["PAID", "READY", "DELIVERED", "CANCELLED"];

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
