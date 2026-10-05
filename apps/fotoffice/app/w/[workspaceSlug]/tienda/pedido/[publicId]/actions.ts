"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { storeOrderCookieName } from "@/lib/store/order-access";
import { findStoreOrderForPage, tokenOpensOrder } from "@/lib/store/order-page";
import { startStoreCheckout } from "@/lib/store/payment";
import { loadOpenStore } from "@/lib/store/repository";

export type RetryPaymentResult = { ok: false; error: string };

/**
 * "Volver a pagar" un pedido que sigue esperando el pago (la persona cerró Mercado Pago, o el
 * pago fue rechazado). Pide el mismo acceso que la página: la cookie del pedido. Si sale bien no
 * vuelve: redirige a Mercado Pago.
 */
export async function retryStorePaymentAction(workspaceSlug: unknown, publicId: unknown): Promise<RetryPaymentResult> {
  const noEsta = { ok: false as const, error: "No encontramos ese pedido." };
  if (typeof workspaceSlug !== "string" || typeof publicId !== "string") return noEsta;
  const store = await loadOpenStore(workspaceSlug);
  if (!store) return noEsta;
  const pedido = await findStoreOrderForPage(store.workspace.id, publicId);
  if (!pedido) return noEsta;
  const token = (await cookies()).get(storeOrderCookieName(pedido.publicId))?.value;
  if (!tokenOpensOrder(token, pedido)) return noEsta;

  const checkout = await startStoreCheckout({
    workspaceId: store.workspace.id,
    orderId: pedido.id,
    // Mercado Pago vuelve al dominio de FOTOFFICE: lleva el token por si allá no está la cookie.
    returnPath: `/w/${store.workspace.slug}/${STORE_PUBLIC_SEGMENT}/pedido/${pedido.publicId}?t=${encodeURIComponent(token as string)}`,
  });
  if (!checkout.ok) return { ok: false, error: checkout.error };

  // Fuera de cualquier try: `redirect` lanza a propósito.
  redirect(checkout.checkoutUrl);
}
