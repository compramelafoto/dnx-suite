import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { urlDeSubidaArchivo, tamanoDeArchivo } from "@/lib/carpetas/almacen";
import { PRINT_ORDERS_MODULE_KEY } from "@/lib/impresiones/constantes";
import { referenciaPedido, type ResultadoIniciarPagoImpresion } from "@/lib/impresiones/pago-servidor";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { cargarCatalogoProbador } from "./catalogo.server";
import { validarPedido } from "./pedido";

/**
 * El pedido pago del probador de cuadros (spec 2026-10-30, etapa 3). Reusa el circuito de Pedidos de
 * impresión: el pedido es un `FotofficePrintOrder` con `source = "PROBADOR"`, la referencia de
 * Mercado Pago es la misma (`fo-impresion:<id>`) y lo acredita el mismo aviso, así Caja, el trabajo
 * por laboratorio y el envío al laboratorio salen sin código nuevo. Cada cuadro lleva su receta en
 * `probador` y la preparación lo renderiza a su medida (`render.server.ts`).
 *
 * Las fotos del cliente suben directo al depósito privado con PUT firmado, sin sesión: el servidor
 * sólo firma y después comprueba (HEAD) que estén. Nunca loguea datos personales.
 */

export const MAX_FOTOS = 10;
export const MAX_BYTES_FOTO = 40 * 1024 * 1024;
const TIPOS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };
const BORRADOR = /^[A-Za-z0-9_-]{16,32}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FALLO = "No pudimos abrir el pago. Probá de nuevo en un rato.";
const pesos = (n: number) => n.toFixed(2);
const base = () => (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/+$/, "");

export const prefijoProbador = (workspaceId: string) => `fotoffice/probador/${workspaceId}/`;
const claveDeFoto = (workspaceId: string, borrador: string, n: number, ext: string) => `${prefijoProbador(workspaceId)}${borrador}/${n}.${ext}`;

/** Se puede pedir con Pedidos de impresión encendido (su circuito y su cron) y Mercado Pago conectado. */
export async function puedePedir(workspaceId: string): Promise<boolean> {
  const [modulo, collector] = await Promise.all([
    isModuleEnabledForWorkspace(workspaceId, PRINT_ORDERS_MODULE_KEY),
    resolveWorkspaceCollector(workspaceId),
  ]);
  return modulo && collector.ok;
}

export type ResultadoSubidas = { ok: true; borrador: string; subidas: { n: number; url: string; ext: string }[] } | { ok: false; error: string };

/** Firma una subida por foto. Tipo y tamaño quedan dentro de la firma. */
export async function pedirSubidas(workspaceId: string, raw: unknown): Promise<ResultadoSubidas> {
  if (!(await puedePedir(workspaceId))) return { ok: false, error: "Este estudio todavía no toma pedidos online." };
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_FOTOS) return { ok: false, error: `Podés subir hasta ${MAX_FOTOS} fotos.` };
  const borrador = randomBytes(18).toString("base64url");
  const subidas: { n: number; url: string; ext: string }[] = [];
  for (const [n, a] of raw.entries()) {
    const { tipo, bytes } = (a ?? {}) as { tipo?: unknown; bytes?: unknown };
    const ext = typeof tipo === "string" ? TIPOS[tipo] : undefined;
    if (!ext) return { ok: false, error: "Una de las fotos no es JPG, PNG, WebP ni HEIC." };
    if (!Number.isInteger(bytes) || (bytes as number) <= 0 || (bytes as number) > MAX_BYTES_FOTO) {
      return { ok: false, error: "Una de las fotos pesa más de 40 MB." };
    }
    subidas.push({ n, ext, url: await urlDeSubidaArchivo(claveDeFoto(workspaceId, borrador, n, ext), tipo as string, bytes as number) });
  }
  return { ok: true, borrador, subidas };
}

/**
 * Crea el pedido y abre el pago. `datos` trae los datos del cliente, el borrador de las subidas, qué
 * foto es cada índice (`fotos: { indice, n, ext }`) y la composición. El precio lo calcula el servidor.
 */
export async function crearPedidoProbador(workspaceId: string, datos: unknown): Promise<ResultadoIniciarPagoImpresion> {
  const d = (datos ?? {}) as Record<string, unknown>;
  const nombre = typeof d.nombre === "string" ? d.nombre.trim().slice(0, 120) : "";
  const email = typeof d.email === "string" ? d.email.trim().toLowerCase().slice(0, 200) : "";
  const telefono = typeof d.telefono === "string" ? d.telefono.trim().slice(0, 40) : "";
  if (!nombre) return { ok: false, error: "Escribí tu nombre." };
  if (!EMAIL.test(email)) return { ok: false, error: "Revisá tu correo." };
  if (typeof d.borrador !== "string" || !BORRADOR.test(d.borrador)) return { ok: false, error: "Volvé a subir tus fotos." };
  if (!Array.isArray(d.fotos) || d.fotos.length === 0 || d.fotos.length > MAX_FOTOS) return { ok: false, error: "Volvé a subir tus fotos." };

  // Qué clave tiene cada foto: el navegador dice el índice y el número de subida; la clave la arma el servidor.
  const claves = new Map<number, string>();
  for (const f of d.fotos) {
    const { indice, n, ext } = (f ?? {}) as { indice?: unknown; n?: unknown; ext?: unknown };
    if (!Number.isInteger(indice) || !Number.isInteger(n) || (n as number) < 0 || (n as number) >= MAX_FOTOS) return { ok: false, error: "Volvé a subir tus fotos." };
    if (typeof ext !== "string" || !Object.values(TIPOS).includes(ext)) return { ok: false, error: "Volvé a subir tus fotos." };
    claves.set(indice as number, claveDeFoto(workspaceId, d.borrador, n as number, ext));
  }
  const [catalogo, pedir, branding] = await Promise.all([
    cargarCatalogoProbador(workspaceId),
    puedePedir(workspaceId),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { publicSlug: true } }),
  ]);
  if (!pedir || !branding?.publicSlug) return { ok: false, error: "Este estudio todavía no toma pedidos online." };

  // Sólo cuentan las fotos que de verdad están en el depósito.
  const subidas = new Set<number>();
  for (const [indice, clave] of claves) if ((await tamanoDeArchivo(clave)) != null) subidas.add(indice);
  const v = validarPedido(d.pedido, catalogo, subidas);
  if (!v.ok) return v;

  const origen = base();
  const collector = await resolveWorkspaceCollector(workspaceId);
  if (!origen || !collector.ok) return { ok: false, error: FALLO };
  const costo = v.renglones.reduce((s, r) => s + (r.precio.costoArs ?? 0), 0);

  let pedido: { id: string; number: number; trackingToken: string };
  try {
    pedido = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-impresion-numero:${workspaceId}`}))`;
      const max = await tx.fotofficePrintOrder.aggregate({ where: { workspaceId }, _max: { number: true } });
      return tx.fotofficePrintOrder.create({
        data: {
          workspaceId,
          number: (max._max.number ?? 0) + 1,
          source: "PROBADOR",
          nombre,
          email,
          telefono: telefono || null,
          // Las columnas de papel son de las copias; en los cuadros no se usan.
          paper: "BRILLO",
          delivery: "RETIRO",
          subtotalArs: pesos(v.totalArs),
          shippingArs: "0",
          totalArs: pesos(v.totalArs),
          costTotalArs: pesos(costo),
          pricingSnapshot: { probador: v.renglones.map((r) => ({ productoId: r.precio.productoId, nombre: r.precio.nombre, precioArs: r.precio.precioArs })) },
          composicion: { cuadros: v.mapa },
          trackingToken: randomBytes(18).toString("base64url"),
          items: {
            create: v.renglones.map((r) => ({
              sourceKey: claves.get(r.foto)!,
              sourceName: `Cuadro ${r.receta.orden} de ${r.receta.total}`,
              widthCm: r.receta.ventana.w,
              heightCm: r.receta.ventana.h,
              quantity: 1,
              unitPriceArs: pesos(r.precio.precioArs),
              unitCostArs: pesos(r.precio.costoArs ?? 0),
              cropX: 0,
              cropY: 0,
              cropW: 1,
              cropH: 1,
              proveedorId: r.precio.proveedorId,
              probador: r.receta,
            })),
          },
        },
        select: { id: true, number: true, trackingToken: true },
      });
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    console.error("[probador] no se pudo crear el pedido", { codigo: (e as { code?: unknown } | null)?.code ?? "desconocido" });
    return { ok: false, error: FALLO };
  }

  const vuelta = (estado: string) =>
    `${origen}/w/${encodeURIComponent(branding.publicSlug)}/impresion/${pedido.trackingToken}?pago=${estado}&pedido=${encodeURIComponent(pedido.id)}`;
  try {
    const pref = await createMercadoPagoCheckoutProLiveAdapter({}).createPreference({
      amountMinor: Math.round(v.totalArs * 100),
      currency: "ARS",
      description: `Cuadros · pedido ${pedido.number}`,
      externalReference: referenciaPedido(pedido.id),
      idempotencyKey: randomUUID(),
      successUrl: vuelta("ok"),
      pendingUrl: vuelta("pendiente"),
      failureUrl: vuelta("error"),
      notificationUrl: `${origen}/api/payments/mp/impresiones-webhook?ws=${encodeURIComponent(workspaceId)}`,
      accessTokenOverride: collector.collector.accessToken,
      itemId: `cuadros-${pedido.id}`,
      sourceApp: "FOTOFFICE",
      metadata: { pedidoId: pedido.id, workspaceId },
      payerEmail: email,
    });
    await prisma.fotofficePrintOrder.update({ where: { id: pedido.id }, data: { mpPreferenceId: pref.providerPreferenceId ?? null } }).catch(() => undefined);
    return { ok: true, checkoutUrl: pref.checkoutUrl, pedidoId: pedido.id };
  } catch (error) {
    console.error("[probador] Mercado Pago rechazó la preferencia", { pedidoId: pedido.id, detalle: sanitizeError(error) });
    return { ok: false, error: FALLO };
  }
}
