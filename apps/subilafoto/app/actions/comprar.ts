"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { COMISION_POR_DEFECTO_BPS } from "@/lib/pagos/comision";
import { calcularVenta } from "@/lib/pagos/venta";
import { cobradorDelVendedor } from "@/lib/pagos/cobrador";
import { revisarComprador } from "@/lib/pagos/comprador";
import { referenciaDeOrden } from "@/lib/pagos/referencia";

/**
 * El cliente compra el evento.
 *
 * El orden importa y es a propósito: primero se revisan los datos, después se resuelve el
 * cobrador, **después** se crea la orden y recién al final se arma la preferencia. Crear
 * la orden antes dejaría órdenes pendientes de nadie cada vez que el vendedor no tiene su
 * cuenta conectada o alguien escribe mal el correo.
 */
export async function comprarEvento(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  // El fotógrafo comparte uno de dos enlaces: con la descarga incluida o sin ella.
  const conDescarga = formData.get("conDescarga") === "si";
  const caminoDeVuelta = `/v/${slug}/comprar${conDescarga ? "?descarga=si&" : "?"}`;
  const volver = (error: string) =>
    redirect(`${caminoDeVuelta}error=${encodeURIComponent(error)}`);

  const revision = revisarComprador({
    nombre: formData.get("nombre"),
    email: formData.get("email"),
    telefono: formData.get("telefono"),
  });
  if (!revision.ok) volver(revision.error);
  const comprador = revision.ok ? revision.datos : null;
  if (!comprador) return;

  const perfil = await prisma.subilafotoSellerProfile.findUnique({
    where: { slug },
    select: {
      id: true,
      displayName: true,
      isPublished: true,
      basePriceCents: true,
    },
  });
  if (!perfil || !perfil.isPublished) redirect("/");
  if (perfil.basePriceCents <= 0) {
    volver("Este vendedor todavía no configuró su precio.");
    return;
  }

  const venta = calcularVenta({ baseCents: perfil.basePriceCents, conDescarga });

  /*
    El cobrador se resuelve antes de crear nada. Si el vendedor no conectó su cuenta, el
    comprador tiene que enterarse acá y no después de completar un formulario y quedar
    frente a un error de Mercado Pago.
  */
  const cobrador = await cobradorDelVendedor(perfil.id);
  if (!cobrador.ok) {
    console.error("[subilafoto][comprar] sin cobrador", { codigo: cobrador.code });
    volver("Este vendedor todavía no puede recibir pagos. Escribile para avisarle.");
    return;
  }

  const orden = await prisma.subilafotoOrder.create({
    data: {
      sellerProfileId: perfil.id,
      kind: "EVENT",
      status: "PENDING",
      buyerEmail: comprador.email,
      buyerName: comprador.nombre,
      buyerPhone: comprador.telefono,
      amountCents: venta.totalCents,
      includesDownload: conDescarga,
      platformFeeBps: COMISION_POR_DEFECTO_BPS,
      // Comisión más recargo: lo que efectivamente retiene la plataforma.
      platformFeeCents: venta.plataformaCents,
      sellerNetCents: venta.vendedorCents,
      mpCollectorId: cobrador.collector.providerUserId,
    },
    select: { id: true },
  });

  const base = new URL((await headers()).get("origin") ?? "https://subilafoto.com").origin;

  let checkoutUrl: string;
  try {
    const adaptador = createMercadoPagoCheckoutProLiveAdapter({
      accessToken: cobrador.collector.accessToken,
    });

    const preferencia = await adaptador.createPreference({
      amountMinor: venta.totalCents,
      currency: "ARS",
      description: conDescarga
        ? `SubiLaFoto — ${perfil.displayName} (con descarga)`
        : `SubiLaFoto — ${perfil.displayName}`,
      externalReference: referenciaDeOrden(orden.id),
      // Si Mercado Pago recibe dos veces el mismo pedido, devuelve la misma
      // preferencia en vez de crear dos. Pasa con un doble clic.
      idempotencyKey: `subilafoto-orden-${orden.id}-${randomUUID()}`,
      payerEmail: comprador.email,
      successUrl: `${base}/compra/${orden.id}/gracias`,
      pendingUrl: `${base}/compra/${orden.id}/gracias`,
      failureUrl: `${base}/compra/${orden.id}/error`,
      // En Checkout Pro la URL de aviso viaja en la preferencia, no en el panel:
      // por eso cada producto puede tener la suya.
      notificationUrl: `${base}/api/pagos/aviso`,
      marketplaceFeeMinor: venta.plataformaCents,
      sourceApp: "subilafoto",
    });

    await prisma.subilafotoOrder.update({
      where: { id: orden.id },
      data: { mpPreferenceId: preferencia.providerPreferenceId },
    });

    checkoutUrl = preferencia.checkoutUrl;
  } catch (error) {
    // La orden queda en PENDING y sin preferencia: no se puede pagar y no ensucia nada.
    console.error("[subilafoto][comprar] Mercado Pago rechazó la preferencia", {
      orden: orden.id,
      detalle: error instanceof Error ? error.name : "desconocido",
    });
    volver("No pudimos abrir el pago. Probá de nuevo en un momento.");
    return;
  }

  redirect(checkoutUrl);
}
