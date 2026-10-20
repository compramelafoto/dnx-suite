import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { PREFIJO_REFERENCIA_IMPRESION } from "./constantes";
import { validarCarrito } from "./carrito";
import { cotizar } from "./precios";
import { ofertaPublica } from "./configuracion-servidor";
import { fotosAptas, proyectoDeTokenCliente } from "./fuentes-servidor";

/**
 * Crear el pedido de copias impresas y abrir el cobro en Mercado Pago (Checkout Pro con la cuenta del
 * estudio, como `lib/galerias/pago.ts`). El precio lo calcula SIEMPRE el servidor con la oferta vigente: lo
 * que manda el navegador sólo dice qué fotos, qué tamaños, cuántas y cómo recortarlas.
 *
 * El pedido nace PENDIENTE_PAGO; lo acredita el aviso de Mercado Pago (o la vuelta del comprador). Nunca
 * loguea datos personales: sólo códigos.
 */

export const referenciaPedido = (id: string) => `${PREFIJO_REFERENCIA_IMPRESION}${id}`;

export function pedidoDeReferencia(raw: unknown): string | null {
  return typeof raw === "string" && raw.startsWith(PREFIJO_REFERENCIA_IMPRESION) && raw.length > PREFIJO_REFERENCIA_IMPRESION.length
    ? raw.slice(PREFIJO_REFERENCIA_IMPRESION.length)
    : null;
}

export type ResultadoIniciarPagoImpresion = { ok: true; checkoutUrl: string; pedidoId: string } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FALLO = "No pudimos abrir el pago. Probá de nuevo en un rato.";
const SIN_COBROS = "El estudio todavía no puede cobrar online. Escribile para hacer el pedido.";
const base = () => (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/+$/, "");
const pesos = (cents: number) => (cents / 100).toFixed(2);
const falla = (error: string) => ({ ok: false as const, error });

export async function iniciarPagoImpresion(workspaceId: string, token: unknown, datos: unknown): Promise<ResultadoIniciarPagoImpresion> {
  const d = (datos ?? {}) as Record<string, unknown>;
  const nombre = typeof d.nombre === "string" ? d.nombre.trim().slice(0, 120) : "";
  const email = typeof d.email === "string" ? d.email.trim().toLowerCase().slice(0, 200) : "";
  const telefono = typeof d.telefono === "string" ? d.telefono.trim().slice(0, 40) : "";
  if (!nombre) return falla("Escribí tu nombre.");
  if (!EMAIL.test(email)) return falla("Revisá tu correo.");

  const [oferta, proyecto, branding] = await Promise.all([
    ofertaPublica(workspaceId),
    proyectoDeTokenCliente(workspaceId, token),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { publicSlug: true } }),
  ]);
  if (!oferta || !proyecto || !branding?.publicSlug) return falla("Este enlace ya no permite pedir copias.");
  const fotos = await fotosAptas(workspaceId, proyecto.proyectoId);
  const porId = new Map(fotos.map((f) => [f.archivoId, f]));
  const carrito = validarCarrito(d.carrito, new Set(porId.keys()), oferta.papeles);
  if (!carrito.ok) return falla(carrito.error);
  const c = cotizar(carrito.lineas, oferta.tamanos);
  if ("error" in c) return falla(c.error);

  const origen = base();
  if (!origen) return falla(FALLO);
  const collector = await resolveWorkspaceCollector(workspaceId);
  if (!collector.ok) return falla(SIN_COBROS);

  let pedido: { id: string; number: number; trackingToken: string };
  try {
    pedido = await prisma.$transaction(async (tx) => {
      // El número es correlativo por estudio: dos pedidos a la vez no se pisan.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-impresion-numero:${workspaceId}`}))`;
      const max = await tx.fotofficePrintOrder.aggregate({ where: { workspaceId }, _max: { number: true } });
      return tx.fotofficePrintOrder.create({
        data: {
          workspaceId,
          number: (max._max.number ?? 0) + 1,
          source: "CARPETA",
          proyectoOrigenId: proyecto.proyectoId,
          clientId: proyecto.clientId,
          nombre,
          email,
          telefono: telefono || null,
          paper: carrito.papel,
          delivery: "RETIRO",
          subtotalArs: pesos(c.subtotalCents),
          shippingArs: "0",
          totalArs: pesos(c.subtotalCents),
          costTotalArs: pesos(c.costCents),
          pricingSnapshot: { tamanos: oferta.tamanos, gananciaCents: c.gananciaCents, copias: c.copias },
          trackingToken: randomBytes(18).toString("base64url"),
          items: {
            create: c.lineas.map((l) => {
              const f = porId.get(l.archivoId)!;
              return {
                archivoId: l.archivoId,
                sourceKey: f.key,
                sourceName: f.nombre,
                sizeId: l.sizeId,
                widthCm: l.widthCm,
                heightCm: l.heightCm,
                quantity: l.quantity,
                unitPriceArs: pesos(l.unitPriceCents),
                unitCostArs: pesos(l.unitCostCents),
                cropX: l.recorte.x,
                cropY: l.recorte.y,
                cropW: l.recorte.w,
                cropH: l.recorte.h,
                proveedorId: l.proveedorId,
              };
            }),
          },
        },
        select: { id: true, number: true, trackingToken: true },
      });
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    console.error("[impresiones] no se pudo crear el pedido", { codigo: (e as { code?: unknown } | null)?.code ?? "desconocido" });
    return falla(FALLO);
  }

  const vuelta = (estado: string) =>
    `${origen}/w/${encodeURIComponent(branding.publicSlug)}/impresion/${pedido.trackingToken}?pago=${estado}&pedido=${encodeURIComponent(pedido.id)}`;
  try {
    const adapter = createMercadoPagoCheckoutProLiveAdapter({});
    const pref = await adapter.createPreference({
      amountMinor: c.subtotalCents,
      currency: "ARS",
      description: `Copias impresas · pedido ${pedido.number}`,
      externalReference: referenciaPedido(pedido.id),
      idempotencyKey: randomUUID(),
      successUrl: vuelta("ok"),
      pendingUrl: vuelta("pendiente"),
      failureUrl: vuelta("error"),
      // `ws`: el aviso lee el pago directo con el token de este estudio, sin adivinar.
      notificationUrl: `${origen}/api/payments/mp/impresiones-webhook?ws=${encodeURIComponent(workspaceId)}`,
      accessTokenOverride: collector.collector.accessToken,
      itemId: `impresion-${pedido.id}`,
      sourceApp: "FOTOFFICE",
      metadata: { pedidoId: pedido.id, workspaceId },
      payerEmail: email,
    });
    await prisma.fotofficePrintOrder
      .update({ where: { id: pedido.id }, data: { mpPreferenceId: pref.providerPreferenceId ?? null } })
      .catch(() => undefined);
    return { ok: true, checkoutUrl: pref.checkoutUrl, pedidoId: pedido.id };
  } catch (error) {
    console.error("[impresiones] Mercado Pago rechazó la preferencia", { pedidoId: pedido.id, detalle: sanitizeError(error) });
    return falla(FALLO);
  }
}
