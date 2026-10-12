import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { decimalArsToMinor } from "@/lib/membership/money";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { acreditarPagoGaleria } from "./acreditar";
import { carritoDeCliente } from "./carrito";
import { armarSnapshot } from "./compras";
import { registrarEvento } from "./eventos";
import { urlDeGaleria } from "./enlace";
import { centavosAArs } from "./precios";
import { puedeEditarElCliente } from "./seleccion";
import { resolverTokenGaleria, type Falla } from "./publico";
import { SELECT_CONFIG_VENTA, configVentaDeFila } from "./venta";
import {
  MENSAJES_PAGO_GALERIA as M,
  compraDeReferencia,
  idDeCompraValido,
  paymentIdValido,
  referenciaCompra,
  type ResultadoVueltaGaleria,
} from "./venta-publica";

/**
 * Pagar las fotos extra con Mercado Pago (etapa 7, Entrega A2). Es el mismo circuito que las cuotas de los
 * pedidos (`lib/pedidos/mp.ts`): Checkout Pro con el token de la organización; el dinero no pasa por DNX. SIN
 * `marketplace_fee`: hasta el PR 357 un cobro no retiene comisión de plataforma.
 *
 * - `iniciarPagoGaleria`: acción pública atada al token. El precio lo calcula el servidor con las fotos que el
 *   cliente tiene elegidas y las que ya pagó; crea (o reutiliza) una compra PENDIENTE con la instantánea de las
 *   fotos y abre la preferencia.
 * - `verificarVueltaGaleria`: a la vuelta del comprador; la dirección no se cree, se le pregunta a Mercado Pago
 *   con el token de la organización.
 *
 * Nunca loguea datos personales: sólo códigos.
 */

const POR_OMISION_DESCRIPCION = 120;

export type ResultadoIniciarPagoGaleria = { ok: true; checkoutUrl: string; compraId: string } | Falla;

const falla = (error: string, codigo: Falla["codigo"] = "REGLA"): Falla => ({ ok: false, error, codigo });

function origenDeLaApp(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/+$/, "");
}

export async function iniciarPagoGaleria(workspaceId: string, token: unknown): Promise<ResultadoIniciarPagoGaleria> {
  const r = await resolverTokenGaleria(workspaceId, token);
  if (!r.ok || typeof token !== "string") return falla(M.enlaceInvalido, "INVALIDO");
  if (r.galeria.kind !== "SELECCION") return falla(M.sinVenta);
  const g = await prisma.fotofficeGaleria.findFirst({ where: { id: r.galeria.id, workspaceId }, select: { id: true, name: true, ...SELECT_CONFIG_VENTA } });
  if (!g) return falla(M.enlaceInvalido, "INVALIDO");
  const config = configVentaDeFila(g);
  if (config.saleMode === "SELECCION") return falla(M.sinVenta);
  if (!puedeEditarElCliente(r.cliente.status)) return falla(M.yaEnviada, "SOLO_LECTURA");

  const collector = await resolveWorkspaceCollector(workspaceId);
  if (!collector.ok) return falla(M.sinCobros);

  const sitio = await sitioDelWorkspace(workspaceId);
  const base = origenDeLaApp();
  if (!base) return falla(M.sinDireccion);
  const enlace = sitio ? urlDeGaleria({ customDomain: sitio.customDomain, appOrigin: base, slug: sitio.slug, token }) : null;
  if (!enlace) return falla(M.sinEnlace);

  // Una sola corrida por cliente a la vez: dos clics juntos no arman dos compras con las mismas fotos.
  type Armado = { compraId: string; totalCents: number } | { error: string };
  let armado: Armado;
  try {
    armado = await prisma.$transaction(async (tx): Promise<Armado> => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-galeria-cliente:${r.cliente.id}`}))`;
      const vigente = await tx.fotofficeGaleria.findFirst({ where: { id: g.id, workspaceId }, select: { id: true, ...SELECT_CONFIG_VENTA } });
      if (!vigente) return { error: M.enlaceInvalido };
      const cfg = configVentaDeFila(vigente);
      if (cfg.saleMode === "SELECCION") return { error: M.sinVenta };
      const carrito = await carritoDeCliente(tx, workspaceId, r.cliente.id, cfg);
      if (carrito.extras.length < 1 || carrito.totalCents <= 0) return { error: M.sinExtras };

      const pendientes = await tx.fotofficeGaleriaCompra.findMany({
        where: { workspaceId, galeriaClienteId: r.cliente.id, status: "PENDIENTE" },
        select: { id: true, totalArs: true },
      });
      const fotosDe = async (compraId: string) =>
        (await tx.fotofficeGaleriaCompraFoto.findMany({ where: { compraId }, select: { fotoId: true } })).map((f) => f.fotoId).sort();
      const quiero = [...carrito.extras].sort();
      let reutilizable: string | null = null;
      for (const p of pendientes) {
        if (reutilizable === null && decimalArsToMinor(p.totalArs) === carrito.totalCents) {
          const fotos = await fotosDe(p.id);
          if (fotos.length === quiero.length && fotos.every((f, i) => f === quiero[i])) {
            reutilizable = p.id;
            continue;
          }
        }
        // Cambió el carrito: la compra vieja pasa a CANCELADA (si igual la pagan, se acepta y queda constancia).
        await tx.fotofficeGaleriaCompra.updateMany({ where: { id: p.id, workspaceId, status: "PENDIENTE" }, data: { status: "CANCELADA" } });
        await registrarEvento(tx, { workspaceId, galeriaId: g.id, galeriaClienteId: r.cliente.id, tipo: "COMPRA_CANCELADA", data: { compraId: p.id, motivo: "CARRITO_CAMBIO" } });
      }
      if (reutilizable) return { compraId: reutilizable, totalCents: carrito.totalCents };

      const compra = await tx.fotofficeGaleriaCompra.create({
        data: {
          workspaceId, galeriaId: g.id, galeriaClienteId: r.cliente.id, status: "PENDIENTE",
          extraCount: carrito.extras.length,
          subtotalArs: centavosAArs(carrito.subtotalCents),
          discountArs: centavosAArs(carrito.descuentoCents),
          totalArs: centavosAArs(carrito.totalCents),
          pricingSnapshot: armarSnapshot(cfg, carrito, "MERCADO_PAGO"),
        },
        select: { id: true },
      });
      await tx.fotofficeGaleriaCompraFoto.createMany({ data: carrito.extras.map((fotoId) => ({ compraId: compra.id, fotoId })) });
      return { compraId: compra.id, totalCents: carrito.totalCents };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    console.error("[galerias] no se pudo armar la compra", { codigo: (e as { code?: unknown } | null)?.code ?? "desconocido" });
    return falla(M.fallo);
  }
  if ("error" in armado) return falla(armado.error);

  const vuelta = (pago: string) => `${enlace}?pago=${pago}&compra=${encodeURIComponent(armado.compraId)}`;
  try {
    const adapter = createMercadoPagoCheckoutProLiveAdapter({});
    const preferencia = await adapter.createPreference({
      amountMinor: armado.totalCents,
      currency: "ARS",
      description: `Fotos extra · ${g.name}`.slice(0, POR_OMISION_DESCRIPCION),
      externalReference: referenciaCompra(armado.compraId),
      idempotencyKey: randomUUID(),
      successUrl: vuelta("ok"),
      pendingUrl: vuelta("pendiente"),
      failureUrl: vuelta("error"),
      notificationUrl: `${base}/api/payments/mp/galerias-webhook`,
      accessTokenOverride: collector.collector.accessToken,
      itemId: `galcompra-${armado.compraId}`,
      sourceApp: "FOTOFFICE",
      metadata: { compraId: armado.compraId, workspaceId },
      ...(r.cliente.email ? { payerEmail: r.cliente.email } : {}),
    });
    await prisma.fotofficeGaleriaCompra
      .updateMany({ where: { id: armado.compraId, workspaceId, status: "PENDIENTE" }, data: { mpPreferenceId: preferencia.providerPreferenceId ?? null } })
      .catch(() => undefined);
    return { ok: true, checkoutUrl: preferencia.checkoutUrl, compraId: armado.compraId };
  } catch (error) {
    console.error("[galerias] MercadoPago rechazó la preferencia", { compraId: armado.compraId, detalle: sanitizeError(error) });
    return falla(M.fallo);
  }
}

// --- Vuelta del comprador ---------------------------------------------------------------------------------

/**
 * A la vuelta del comprador: le pregunta a Mercado Pago por el pago (el `payment_id` de la dirección, o la
 * búsqueda por la referencia de la compra) y, si está aprobado y es de una compra de ESTE cliente, lo acredita.
 * Como `verificarPagoCuota`. Nunca lanza.
 */
export async function verificarVueltaGaleria(
  workspaceId: string,
  token: unknown,
  datos: { compraId: unknown; paymentId: unknown },
): Promise<ResultadoVueltaGaleria | null> {
  try {
    if (!idDeCompraValido(datos.compraId)) return null;
    const r = await resolverTokenGaleria(workspaceId, token);
    if (!r.ok) return null;
    // La compra tiene que ser de ESTE cliente de ESTA organización (la dirección no se cree).
    const compra = await prisma.fotofficeGaleriaCompra.findFirst({
      where: { id: datos.compraId, workspaceId, galeriaClienteId: r.cliente.id },
      select: { id: true, status: true },
    });
    if (!compra) return "sin_pago";
    if (compra.status === "PAGADA") return "ya_acreditado";

    const collector = await resolveWorkspaceCollector(workspaceId);
    if (!collector.ok) return "sin_cobros";
    const adapter = createMercadoPagoCheckoutProLiveAdapter({ accessToken: collector.collector.accessToken });
    const paymentId = paymentIdValido(datos.paymentId) ? datos.paymentId : null;
    let pago;
    try {
      pago = paymentId ? await adapter.getPayment(paymentId) : await adapter.searchPaymentsByExternalReference(referenciaCompra(compra.id));
    } catch (error) {
      // Un `payment_id` inventado, o de otra organización, también cae acá: no es un error nuestro.
      console.warn("[galerias] no se pudo consultar el pago en Mercado Pago", { detalle: sanitizeError(error) });
      return "no_disponible";
    }
    if (!pago) return "sin_pago";
    if (compraDeReferencia(pago.externalReference) !== compra.id) return "sin_pago";

    const a = await acreditarPagoGaleria(workspaceId, pago);
    switch (a.resultado) {
      case "acreditado":
      case "ya_acreditado":
      case "sin_aplicar":
      case "no_aprobado":
      case "fallo":
        return a.resultado;
      default:
        return "sin_pago";
    }
  } catch (error) {
    console.error("[galerias] falló la verificación de la vuelta", { detalle: sanitizeError(error) });
    return "fallo";
  }
}
