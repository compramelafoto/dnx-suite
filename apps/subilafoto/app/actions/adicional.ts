"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { estadoDelAdicional } from "@/lib/adicional";
import { precioDeLaDescarga } from "@/lib/pagos/venta";
import { referenciaDeOrden } from "@/lib/pagos/referencia";

/**
 * El cliente compra la descarga de todo el material.
 *
 * Es una orden **aparte** de la del evento y se cobra distinto: el ingreso es 100% de la
 * plataforma, así que se cobra con **nuestra** cuenta de Mercado Pago y no con la del
 * vendedor, y no lleva `marketplace_fee` porque no hay nada que repartir.
 *
 * Ese es todo el sentido del capítulo 12.4 y de la regla anti-bypass: si el fotógrafo
 * pudiera entregar los originales por su cuenta, este adicional no se vendería nunca.
 */
export async function comprarAdicional(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const volver = (error: string) =>
    redirect(`/cliente/${token}?error=${encodeURIComponent(error)}`);

  if (!token) redirect("/");

  const enlace = await prisma.subilafotoAccessLink.findUnique({
    where: { token },
    select: {
      revokedAt: true,
      expiresAt: true,
      kind: true,
      event: {
        select: {
          id: true,
          name: true,
          downloadStatus: true,
          retentionUntil: true,
          sellerProfile: {
            select: { id: true, basePriceCents: true },
          },
        },
      },
    },
  });

  const ahora = new Date();
  const vigente =
    enlace &&
    enlace.kind === "CLIENT" &&
    !enlace.revokedAt &&
    (!enlace.expiresAt || enlace.expiresAt > ahora);
  if (!vigente) redirect("/");

  const evento = enlace.event;
  const estado = estadoDelAdicional({
    downloadStatus: evento.downloadStatus,
    adicionalCents: precioDeLaDescarga(evento.sellerProfile.basePriceCents),
    retentionUntil: evento.retentionUntil,
    ahora,
  });
  if (!estado.sePuede) volver(estado.motivo);
  const precioCents = estado.sePuede ? estado.precioCents : 0;

  /*
    Nuestra cuenta, no la del vendedor. Es la diferencia entera con la orden del evento y
    la razón por la que el adicional existe como orden separada.
  */
  const nuestroToken = process.env.SUBILAFOTO_MP_ACCESS_TOKEN?.trim();
  if (!nuestroToken) {
    console.error("[subilafoto][adicional] falta SUBILAFOTO_MP_ACCESS_TOKEN");
    volver("No pudimos abrir el pago. Probá de nuevo en un momento.");
    return;
  }

  // Si ya hay una orden pendiente para este evento, se reusa en vez de acumular una por
  // cada vez que el cliente toca el botón y se arrepiente.
  const pendiente = await prisma.subilafotoOrder.findFirst({
    where: { eventId: evento.id, kind: "DOWNLOAD_ADDON", status: "PENDING" },
    select: { id: true },
  });

  const orden =
    pendiente ??
    (await prisma.subilafotoOrder.create({
      data: {
        sellerProfileId: evento.sellerProfile.id,
        // Sin esto el aviso de pago no sabría a qué evento darle la descarga.
        eventId: evento.id,
        kind: "DOWNLOAD_ADDON",
        status: "PENDING",
        buyerEmail: "",
        buyerName: evento.name,
        amountCents: precioCents,
        // El 100% es de la plataforma: la comisión es la venta entera y el
        // vendedor no recibe nada de esta orden.
        platformFeeBps: 10_000,
        platformFeeCents: precioCents,
        sellerNetCents: 0,
      },
      select: { id: true },
    }));

  const base = new URL((await headers()).get("origin") ?? "https://subilafoto.com").origin;

  let checkoutUrl: string;
  try {
    const adaptador = createMercadoPagoCheckoutProLiveAdapter({ accessToken: nuestroToken });

    const preferencia = await adaptador.createPreference({
      amountMinor: precioCents,
      currency: "ARS",
      description: `Descarga completa — ${evento.name}`,
      externalReference: referenciaDeOrden(orden.id),
      idempotencyKey: `subilafoto-adicional-${orden.id}-${randomUUID()}`,
      successUrl: `${base}/cliente/${token}?pago=listo`,
      pendingUrl: `${base}/cliente/${token}?pago=pendiente`,
      failureUrl: `${base}/cliente/${token}?pago=error`,
      notificationUrl: `${base}/api/pagos/aviso`,
      // Sin `marketplaceFeeMinor`: cobramos nosotros y no hay nada que retener.
      sourceApp: "subilafoto",
    });

    await prisma.subilafotoOrder.update({
      where: { id: orden.id },
      data: { mpPreferenceId: preferencia.providerPreferenceId },
    });

    checkoutUrl = preferencia.checkoutUrl;
  } catch (error) {
    console.error("[subilafoto][adicional] Mercado Pago rechazó la preferencia", {
      orden: orden.id,
      detalle: error instanceof Error ? error.name : "desconocido",
    });
    volver("No pudimos abrir el pago. Probá de nuevo en un momento.");
    return;
  }

  /*
    Fuera del `try` a propósito. `redirect` funciona lanzando una excepción de control, y
    si la atrapa el `catch` de arriba el cliente se queda en la página sin enterarse de que
    el pago estaba listo. Reconocerla por el mensaje no sirve: viaja en `digest`.
  */
  redirect(checkoutUrl);
}
