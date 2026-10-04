"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { appUrl } from "@/lib/app-url";
import { getAuthUser } from "@/lib/auth";
import { listUserProfiles } from "@/lib/portal/profiles";
import { parseCheckoutInput } from "@/lib/store/checkout-input";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { createStoreOrder } from "@/lib/store/create-order";
import { storeOrderCookieName, storeVisibleBase } from "@/lib/store/order-access";
import { startStoreCheckout } from "@/lib/store/payment";
import { loadOpenStore } from "@/lib/store/repository";
import type { CartProblem } from "@/lib/store/storefront";
import { hostWithoutPort } from "@/lib/website/domain/normalize";

export type PlaceOrderResult = {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string>;
  problems?: CartProblem[];
  /** La clave de compra ya no sirve (su pedido se pagó, venció o era de otro carrito): generar otra. */
  renewKey?: boolean;
};

const COOKIE_DIAS = 30;

/** Si quien compra tiene sesión y es socio activo de ESTA institución, su ficha; si no, null. */
async function socioDeEstaInstitucion(workspaceId: string): Promise<string | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const perfiles = await listUserProfiles(user.id);
  const socio = perfiles.find((p) => p.kind === "MEMBER" && p.workspaceId === workspaceId);
  return socio && socio.kind === "MEMBER" ? socio.memberId : null;
}

/**
 * "Pagar con Mercado Pago". Pública: no exige cuenta (si hay sesión de socio, el pedido queda
 * asociado a su ficha). Lo que manda el navegador es basura hasta que pasa `parseCheckoutInput`,
 * y de él sólo se usan los datos del comprador, qué productos y cuántos: precios y nombres los
 * pone el servidor.
 *
 * Si sale bien no vuelve: redirige a Mercado Pago. Si falla, devuelve el motivo para mostrarlo.
 */
export async function placeOrderAction(workspaceSlug: unknown, raw: unknown): Promise<PlaceOrderResult> {
  if (typeof workspaceSlug !== "string" || workspaceSlug.length === 0 || workspaceSlug.length > 100) {
    return { ok: false, error: "La tienda no existe." };
  }
  const store = await loadOpenStore(workspaceSlug);
  if (!store) return { ok: false, error: "La tienda no está disponible en este momento." };
  const workspaceId = store.workspace.id;
  // El slug de la base, no el que mandó el navegador: con él se arma la cookie y la vuelta del pago.
  const slug = store.workspace.slug;

  const parsed = parseCheckoutInput(raw);
  if (!parsed.ok) {
    return { ok: false, error: "Revisá los datos marcados.", fieldErrors: parsed.errors };
  }

  const memberId = await socioDeEstaInstitucion(workspaceId);

  const pedido = await createStoreOrder({ workspaceId, memberId, checkout: parsed.value });
  if (!pedido.ok) {
    return { ok: false, error: pedido.error, problems: pedido.problems, renewKey: pedido.renewKey };
  }

  const base = `/w/${slug}/${STORE_PUBLIC_SEGMENT}`;
  // La cookie se ata a la ruta que VE el navegador: en el dominio propio de la institución la
  // tienda está en `/tienda`, no en `/w/<slug>/tienda` (ver `storeVisibleBase`).
  const h = await headers();
  const host = hostWithoutPort(h.get("x-forwarded-host") ?? h.get("host") ?? "");
  (await cookies()).set(storeOrderCookieName(pedido.publicId), pedido.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_DIAS * 24 * 60 * 60,
    path: storeVisibleBase({ slug, host, fotofficeOrigin: appUrl() }),
  });

  // La vuelta lleva el token además de la cookie: Mercado Pago devuelve al dominio de FOTOFFICE,
  // y quien compró desde el dominio propio de la institución no tiene la cookie allá.
  const checkout = await startStoreCheckout({
    workspaceId,
    orderId: pedido.orderId,
    returnPath: `${base}/pedido/${pedido.publicId}?t=${encodeURIComponent(pedido.accessToken)}`,
  });
  if (!checkout.ok) return { ok: false, error: checkout.error };

  // Fuera de cualquier try: `redirect` lanza a propósito.
  redirect(checkout.checkoutUrl);
}
