"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { appUrl } from "@/lib/app-url";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/geocode/rate-limit";
import { listUserProfiles } from "@/lib/portal/profiles";
import { parseCheckoutInput } from "@/lib/store/checkout-input";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { createStoreOrder } from "@/lib/store/create-order";
import { storeOrderCookieName, storeVisibleBase } from "@/lib/store/order-access";
import { startStoreCheckout } from "@/lib/store/payment";
import { loadOpenStore } from "@/lib/store/repository";
import type { PublicAgency, PublicQuoteResult } from "@/lib/store/shipping/checkout";
import {
  listAgenciesForCheckout,
  loadCheckoutDeliveryOptions,
  quoteForCheckout,
} from "@/lib/store/shipping/checkout-server";
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
 * y de él sólo se usan los datos del comprador, qué productos y cuántos, y a dónde va: precios
 * (también el del envío), nombres y datos de la sucursal los pone el servidor.
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

  // El retiro, sólo si la institución lo ofrece. Que el envío elegido esté habilitado (y su
  // precio) lo comprueba `createStoreOrder`, que además lo vuelve a cotizar en el servidor.
  if (parsed.value.delivery.method === "PICKUP" && !(await loadCheckoutDeliveryOptions(workspaceId)).pickup) {
    return { ok: false, error: "El retiro en la sede no está disponible. Elegí otra forma de entrega." };
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

const FRENO_LIMITE = 30;
const FRENO_VENTANA_MS = 5 * 60 * 1000;
const FRENO_MENSAJE = "Hiciste muchas consultas seguidas. Esperá unos minutos y probá de nuevo.";

/** El freno de memoria por IP (el de `lib/geocode/rate-limit.ts`): 30 consultas cada 5 minutos. */
async function frenado(accion: string): Promise<boolean> {
  const ip = clientIp(await headers());
  return !checkRateLimit({ key: `tienda-${accion}:${ip}`, limit: FRENO_LIMITE, windowMs: FRENO_VENTANA_MS }).allowed;
}

function slugValido(workspaceSlug: unknown): workspaceSlug is string {
  return typeof workspaceSlug === "string" && workspaceSlug.length > 0 && workspaceSlug.length <= 100;
}

/**
 * Cotiza el envío mientras el comprador completa el checkout. Pública, con freno por IP. Sólo
 * devuelve el total y el nombre del servicio: el precio que vale es el que se vuelve a cotizar
 * en el servidor al crear el pedido (E10).
 */
export async function quoteShippingAction(workspaceSlug: unknown, raw: unknown): Promise<PublicQuoteResult> {
  if (!slugValido(workspaceSlug)) return { ok: false, message: "La tienda no existe." };
  if (await frenado("cotizar-envio")) return { ok: false, message: FRENO_MENSAJE };
  const store = await loadOpenStore(workspaceSlug);
  if (!store) return { ok: false, message: "La tienda no está disponible en este momento." };
  return quoteForCheckout({ workspaceId: store.workspace.id, raw });
}

export type ListAgenciesResult = { ok: true; agencies: PublicAgency[] } | { ok: false; message: string };

/** Sucursales de Correo Argentino de una provincia. Pública, con freno por IP. */
export async function listAgenciesAction(workspaceSlug: unknown, provinceCode: unknown): Promise<ListAgenciesResult> {
  if (!slugValido(workspaceSlug)) return { ok: false, message: "La tienda no existe." };
  if (typeof provinceCode !== "string" || provinceCode.length > 5) return { ok: false, message: "Elegí la provincia." };
  if (await frenado("sucursales")) return { ok: false, message: FRENO_MENSAJE };
  const store = await loadOpenStore(workspaceSlug);
  if (!store) return { ok: false, message: "La tienda no está disponible en este momento." };
  return { ok: true, agencies: await listAgenciesForCheckout({ workspaceId: store.workspace.id, provinceCode }) };
}
