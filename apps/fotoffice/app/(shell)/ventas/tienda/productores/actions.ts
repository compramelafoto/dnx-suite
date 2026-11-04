"use server";

import { revalidatePath } from "next/cache";
import { requireStoreConfigurer, requireStoreOperator } from "@/lib/store/access";
import {
  markOrderSentToProveedor,
  proveedorDelWorkspace,
  regenerateFeedToken,
} from "@/lib/store/fulfillment/repository";

/**
 * Acciones de Ventas → Tienda → Productores. El workspace sale SIEMPRE de la sesión; del
 * formulario sólo llegan ids, y cada consulta los vuelve a filtrar por el workspace.
 *
 * - Marcar que se le pasó un pedido al productor: quien opera los pedidos.
 * - Generar o regenerar el enlace secreto: quien configura la tienda (corta el enlace anterior).
 */

const RUTA = "/ventas/tienda/productores";

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim() : "";
}

export async function markSentAction(fd: FormData): Promise<void> {
  const { workspace } = await requireStoreOperator();
  const orderId = texto(fd, "orderId");
  const proveedorId = texto(fd, "proveedorId");
  if (!orderId || !proveedorId) return;
  await markOrderSentToProveedor(workspace.id, orderId, proveedorId);
  revalidatePath(RUTA);
  revalidatePath(`/ventas/tienda/${orderId}`);
}

export async function regenerateTokenAction(fd: FormData): Promise<void> {
  const { workspace } = await requireStoreConfigurer();
  const proveedorId = texto(fd, "proveedorId");
  if (!proveedorId) return;
  const proveedor = await proveedorDelWorkspace(workspace.id, proveedorId);
  if (!proveedor) return;
  await regenerateFeedToken(workspace.id, proveedor.id);
  revalidatePath(RUTA);
}
