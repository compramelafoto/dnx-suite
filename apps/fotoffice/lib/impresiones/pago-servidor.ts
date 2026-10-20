import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { geocodingProvider } from "@/lib/geocode/nominatim";
import { coordenadasLegibles } from "@/lib/geocode/lugar";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { PREFIJO_REFERENCIA_IMPRESION } from "./constantes";
import { validarCarrito } from "./carrito";
import { cotizar } from "./precios";
import { ofertaPublica } from "./configuracion-servidor";
import { cotizarEnvio, puntoValido } from "./envio";
import { resolverFuente, type FuenteTipo } from "./fuentes-servidor";

/**
 * Crear el pedido de copias impresas y abrir el cobro en Mercado Pago (Checkout Pro con la cuenta del
 * estudio, como `lib/galerias/pago.ts`). El precio lo calcula SIEMPRE el servidor con la oferta vigente: lo
 * que manda el navegador sólo dice qué fotos, qué tamaños, cuántas y cómo recortarlas. Con envío a domicilio
 * manda la dirección elegida y su punto (lat/lon): el costo y los km los recalcula el servidor con sus ajustes,
 * y Mercado Pago cobra el total (copias + envío).
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
const MAX_DIRECCION = 300;
const FUERA_DE_ZONA = "Esa dirección está fuera de la zona de envío. Elegí retirar en el local.";

const MAX_DETALLES = 100;
const SIN_VERIFICAR = "(sin verificar) ";

/** `direccion` es el texto que eligió el navegador: sólo se usa si la geocodificación inversa falla. */
type Entrega = { tipo: "RETIRO" } | { tipo: "ENVIO"; lat: number; lon: number; detalles: string; direccion: string };

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max).trim() : "");

/** Lo que el navegador dice de la entrega. Sin entrega = retiro (como en la etapa 1). Para el envío vale el punto. */
function leerEntrega(raw: unknown): Entrega | { error: string } {
  if (raw === undefined || raw === null) return { tipo: "RETIRO" };
  const e = raw as Record<string, unknown>;
  if (e.tipo === "RETIRO") return { tipo: "RETIRO" };
  if (e.tipo !== "ENVIO") return { error: "Elegí cómo recibir las copias." };
  if (!puntoValido(e.lat, e.lon)) return { error: "Elegí la dirección de envío de la lista." };
  return { tipo: "ENVIO", lat: e.lat as number, lon: e.lon as number, detalles: texto(e.detalles, MAX_DETALLES), direccion: texto(e.direccion, MAX_DIRECCION) };
}

/**
 * La dirección que se guarda sale del punto que se cobra (geocodificación inversa en el servidor), no del texto
 * del navegador. Si Nominatim falla o no responde, no se frena la venta: queda el texto elegido (o el punto)
 * marcado «(sin verificar)» para que el estudio lo revise. Piso, depto o referencia van al final.
 */
async function direccionDelPunto(e: Extract<Entrega, { tipo: "ENVIO" }>): Promise<string> {
  let base: string | null = null;
  try {
    const lugar = await geocodingProvider().reverse(e.lat, e.lon);
    base = texto(lugar?.displayName, MAX_DIRECCION) || null;
  } catch {
    console.warn("[impresiones] no se pudo verificar la dirección de envío");
  }
  const dir = base ?? `${SIN_VERIFICAR}${e.direccion || coordenadasLegibles(e.lat, e.lon)}`;
  return e.detalles ? `${dir} · ${e.detalles}` : dir;
}

export async function iniciarPagoImpresion(
  workspaceId: string,
  slug: string,
  tipo: FuenteTipo,
  token: unknown,
  datos: unknown,
): Promise<ResultadoIniciarPagoImpresion> {
  const d = (datos ?? {}) as Record<string, unknown>;
  const nombre = typeof d.nombre === "string" ? d.nombre.trim().slice(0, 120) : "";
  const email = typeof d.email === "string" ? d.email.trim().toLowerCase().slice(0, 200) : "";
  const telefono = typeof d.telefono === "string" ? d.telefono.trim().slice(0, 40) : "";
  if (!nombre) return falla("Escribí tu nombre.");
  if (!EMAIL.test(email)) return falla("Revisá tu correo.");
  const entrega = leerEntrega(d.entrega);
  if ("error" in entrega) return falla(entrega.error);

  const [oferta, fuente, branding] = await Promise.all([
    ofertaPublica(workspaceId),
    resolverFuente(workspaceId, slug, tipo, token),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { publicSlug: true } }),
  ]);
  if (!oferta || !fuente || !branding?.publicSlug) return falla("Este enlace ya no permite pedir copias.");
  const porId = new Map(fuente.fotos.map((f) => [f.id, f]));
  const carrito = validarCarrito(d.carrito, new Set(porId.keys()), oferta.papeles);
  if (!carrito.ok) return falla(carrito.error);
  const c = cotizar(carrito.lineas, oferta.tamanos);
  if ("error" in c) return falla(c.error);

  // El envío lo calcula el servidor desde el punto elegido y sus propios ajustes; nunca un monto del navegador.
  let envio: { cents: number; km: number; direccion: string; lat: number; lon: number } | null = null;
  if (entrega.tipo === "ENVIO") {
    if (!oferta.envio) return falla("Este estudio no hace envíos. Elegí retirar en el local.");
    const q = cotizarEnvio({ ...oferta.envio, destino: { lat: entrega.lat, lon: entrega.lon } });
    if (!q.ok) return falla(FUERA_DE_ZONA);
    envio = { cents: q.cents, km: q.km, direccion: await direccionDelPunto(entrega), lat: entrega.lat, lon: entrega.lon };
  }
  const totalCents = c.subtotalCents + (envio?.cents ?? 0);
  const esGaleria = fuente.tipo === "GALERIA";

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
          source: fuente.tipo,
          proyectoOrigenId: fuente.proyectoOrigenId,
          galeriaId: fuente.galeriaId,
          clientId: fuente.clientId,
          nombre,
          email,
          telefono: telefono || null,
          paper: carrito.papel,
          delivery: envio ? "ENVIO" : "RETIRO",
          subtotalArs: pesos(c.subtotalCents),
          shippingArs: envio ? pesos(envio.cents) : "0",
          totalArs: pesos(totalCents),
          ...(envio ? { shippingAddress: envio.direccion, shippingLat: envio.lat, shippingLon: envio.lon, shippingKm: envio.km } : {}),
          costTotalArs: pesos(c.costCents),
          pricingSnapshot: {
            tamanos: oferta.tamanos,
            gananciaCents: c.gananciaCents,
            copias: c.copias,
            ...(envio && oferta.envio ? { envio: { baseCents: oferta.envio.baseCents, porKmCents: oferta.envio.porKmCents, maxKm: oferta.envio.maxKm, km: envio.km, cents: envio.cents } } : {}),
          },
          trackingToken: randomBytes(18).toString("base64url"),
          items: {
            create: c.lineas.map((l) => {
              const f = porId.get(l.archivoId)!;
              return {
                // `archivoId` del carrito es el id de la foto en su fuente (archivo de la carpeta o foto de galería).
                ...(esGaleria ? { galeriaFotoId: l.archivoId } : { archivoId: l.archivoId }),
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
      amountMinor: totalCents,
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
