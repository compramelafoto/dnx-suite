import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@repo/db";
import { FULFILLMENT_LABELS, editionLabel, isFulfillment } from "@repo/muestras";
import { baseUrlPublica } from "@/lib/fichas/cargar";
import { frenarPorPedido } from "@/lib/limite";
import { conciliarPedido } from "./conciliar";
import { nombreCookieDePedido } from "./cookie-pedido";
import { pedidoConAcceso, tokenValido } from "./pedido";

/**
 * El pedido del comprador sin cuenta (etapa 8, D25): se abre con el token del enlace o con la
 * cookie del pedido (las dos se comparan con el hash guardado). Si el pago está pendiente y hace
 * más de 30 segundos que no se mira en Mercado Pago, se concilia (camino 2: "la página del pedido"),
 * con el freno `verPedido`.
 */
export const ARREPENTIMIENTO_DIAS = 10;
const DIA = 24 * 60 * 60_000;
const RECONCILIAR_CADA_MS = 30_000;

export const ARREPENTIMIENTO_RECIBIDO =
  "Recibimos tu pedido de arrepentimiento. La organización y la plataforma lo van a revisar y te van a devolver el dinero según los términos.";
export const ARREPENTIMIENTO_VENCIDO =
  `Pasaron más de ${ARREPENTIMIENTO_DIAS} días corridos desde el pago: ya no se puede pedir el arrepentimiento desde acá. Si tenés un problema con tu copia, escribile a la organización de la muestra.`;

type Pedido = NonNullable<Awaited<ReturnType<typeof pedidoConAcceso>>>;

/** El token con el que vino quien mira: el del enlace o el de la cookie. */
export async function tokenDelComprador(publicId: string, t?: string | null): Promise<{ token: string | null; cookie: string | null }> {
  const cookie = (await cookies()).get(nombreCookieDePedido(publicId))?.value ?? null;
  return { token: typeof t === "string" ? t : null, cookie };
}

/** El pedido si quien mira lo puede abrir; si no, `null` (la página responde 404). */
export async function abrirPedido(publicId: string, t?: string | null): Promise<{ pedido: Pedido; token: string } | null> {
  const acceso = await tokenDelComprador(publicId, t);
  const pedido = await pedidoConAcceso(publicId, acceso);
  if (!pedido) return null;
  // El token que abrió el pedido (para el enlace "Guardá este enlace").
  const token = tokenValido(acceso.token, pedido.accessTokenHash) ? acceso.token! : acceso.cookie!;
  return { pedido, token };
}

/** Concilia una vez si está pendiente con Order y hace más de 30 s que no se mira. */
export async function conciliarSiHaceFalta(pedido: Pedido, ahora: Date = new Date()): Promise<Pedido> {
  if (pedido.status !== "PENDING_PAYMENT" || !pedido.providerOrderId) return pedido;
  if (pedido.lastSyncedAt && ahora.getTime() - pedido.lastSyncedAt.getTime() < RECONCILIAR_CADA_MS) return pedido;
  if (!frenarPorPedido("verPedido", pedido.publicId).allowed) return pedido;
  try {
    await conciliarPedido({ publicId: pedido.publicId }, "RETURN");
  } catch (error) {
    console.error("[muestras][ventas] conciliar desde el pedido:", { name: (error as { name?: unknown })?.name ?? "Error" });
    return pedido;
  }
  return (await prisma.culturalSaleOrder.findUnique({ where: { id: pedido.id } })) ?? pedido;
}

export function textoDelEstado(status: string): string {
  switch (status) {
    case "PAID": return "Pago confirmado";
    case "PENDING_PAYMENT": return "Esperando la confirmación de Mercado Pago";
    case "REJECTED": return "El pago no se aprobó";
    case "EXPIRED": return "Reserva vencida";
    case "REFUNDED":
    case "CHARGED_BACK": return "Pago devuelto";
    case "PAID_NO_COPY": return "Cobrado sin copia disponible: la organización se va a comunicar para devolverte el dinero";
    default: return status;
  }
}

/** ¿Todavía se puede pedir el arrepentimiento? Hasta 10 días corridos desde el pago. */
export function puedeArrepentirse(p: { status: string; paidAt: Date | null }, ahora: Date = new Date()): boolean {
  return (p.status === "PAID" || p.status === "PAID_NO_COPY") && p.paidAt != null && ahora.getTime() - p.paidAt.getTime() <= ARREPENTIMIENTO_DIAS * DIA;
}

export type PasoDeProduccion = { texto: string; fecha: Date | null; hecho: boolean };

function pasosDeProduccion(p: Pedido): PasoDeProduccion[] {
  if (p.delivery === "DIGITAL") return [];
  const orden = p.delivery === "SHIPPING" ? ["IN_PRODUCTION", "SHIPPED", "DELIVERED"] : ["IN_PRODUCTION", "READY", "DELIVERED"];
  const actual = orden.indexOf(p.fulfillment);
  const fecha: Record<string, Date | null> = { IN_PRODUCTION: null, READY: p.readyAt, SHIPPED: p.shippedAt, DELIVERED: p.deliveredAt };
  return orden.map((f, i) => ({ texto: isFulfillment(f) ? FULFILLMENT_LABELS[f] : f, fecha: fecha[f] ?? null, hecho: actual >= i }));
}

/** Todo lo que muestra la página del pedido. Nada del reparto ni de otros pedidos. */
export async function vistaDelPedido(p: Pedido, token: string, ahora: Date = new Date()) {
  const [oferta, copia, actividad, setup] = await Promise.all([
    prisma.culturalWorkOffer.findUnique({
      where: { id: p.offerId },
      select: { activityWorkId: true, format: true, editionKind: true, editionSize: true, proofCount: true, paper: true, widthCm: true, heightCm: true },
    }),
    p.copyId ? prisma.culturalEditionCopy.findUnique({ where: { id: p.copyId }, select: { kind: true, number: true, status: true, certificateCode: true } }) : null,
    prisma.culturalActivity.findUnique({ where: { id: p.activityId }, select: { title: true, slug: true, organizersText: true, venueName: true, address: true, city: true, isVirtualOnly: true } }),
    prisma.culturalSaleSetup.findUnique({ where: { activityId: p.activityId }, select: { pickupText: true, shippingText: true } }),
  ]);
  const obra = oferta ? await prisma.culturalActivityWork.findUnique({ where: { id: oferta.activityWorkId }, select: { title: true, authorName: true } }) : null;
  const digital = oferta?.format === "DIGITAL";
  const numero = copia && oferta
    ? editionLabel({ kind: copia.kind, number: copia.number, size: oferta.editionSize, editionKind: oferta.editionKind, proofCount: oferta.proofCount })
    : null;
  const emitida = p.status === "PAID" && copia?.status === "ISSUED" && copia.certificateCode != null;
  const formato = !oferta
    ? ""
    : digital
      ? "Copia digital firmada"
      : ["Copia impresa Fine Art", oferta.paper?.trim() || null, oferta.widthCm != null && oferta.heightCm != null ? `${oferta.widthCm} × ${oferta.heightCm} cm` : null].filter(Boolean).join(" · ");
  const direccion = p.delivery === "SHIPPING" && p.shippingAddress && typeof p.shippingAddress === "object" ? (p.shippingAddress as Record<string, string | null>) : null;
  return {
    publicId: p.publicId,
    status: p.status,
    estado: textoDelEstado(p.status),
    prueba: p.isTest,
    obra: { title: obra?.title ?? "Obra", authorName: obra?.authorName?.trim() || "Autor sin indicar" },
    formato,
    digital,
    numero: numero && (p.status === "PAID" || p.status === "PENDING_PAYMENT") ? numero : null,
    numeroEsCopiaUnica: oferta?.editionKind === "UNIQUE" && copia?.kind !== "PROOF",
    precioArs: p.priceArs,
    envioArs: p.shippingArs,
    totalArs: p.totalCents / 100,
    entrega: {
      tipo: p.delivery,
      texto: p.delivery === "PICKUP" ? setup?.pickupText ?? null : p.delivery === "SHIPPING" ? setup?.shippingText ?? null : null,
      direccion: direccion
        ? [`${direccion.calle ?? ""} ${direccion.numero ?? ""}`.trim(), direccion.pisoDepto, direccion.ciudad, direccion.provincia, direccion.codigoPostal].filter(Boolean).join(", ")
        : null,
    },
    produccion: p.status === "PAID" ? pasosDeProduccion(p) : [],
    seguimiento: p.trackingText,
    certificado: emitida ? { codigo: copia!.certificateCode! } : null,
    copiaAnulada: copia?.status === "VOIDED",
    muestra: actividad
      ? {
          title: actividad.title,
          slug: actividad.slug,
          organizadores: actividad.organizersText?.trim() || null,
          sede: actividad.isVirtualOnly ? null : [actividad.venueName, actividad.address, actividad.city].filter(Boolean).join(", ") || null,
        }
      : null,
    enlace: `${baseUrlPublica()}/compras/${p.publicId}?t=${encodeURIComponent(token)}`,
    arrepentimiento: { puede: puedeArrepentirse(p, ahora), pedido: p.regretRequestedAt },
  };
}

export type VistaDelPedido = Awaited<ReturnType<typeof vistaDelPedido>>;
