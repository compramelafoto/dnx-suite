import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { archivoDeMensaje, claveDeMedia } from "@/lib/bandeja/archivo-de-mensaje";
import { calidadParaMedida } from "@/lib/bandeja/calidad";
import { cotizarCopias, leerProductosDeCopia, nombreDelPlazo, type LineaCotizada, type Plazo, type ProductoDelCatalogo } from "./catalogo-copias";
import { cotizarEnvio, type Punto } from "./envio";
import { fechaPorPlazo } from "./plazos";
import { referenciaPedido } from "./pago-servidor";

/**
 * Pedidos de impresión que arma el bot de WhatsApp (spec 2026-10-28 §3-5): las fotos son los
 * archivos que el cliente mandó al chat (ya en el R2 privado), los precios salen del catálogo, y se
 * abren dos cobros de Mercado Pago (la seña y el total) con la cuenta del estudio. Al acreditarse
 * cualquiera de los dos, el circuito de impresiones lo manda al laboratorio. Un pedido pendiente
 * por chat: el nuevo cancela el anterior. Nunca loguea datos personales.
 */

export type FotoDelPedido = { mensajeId: string };
export type RenglonBot = { fotos: FotoDelPedido[]; medida: string; cantidad: number; plazo: Plazo; papel: "BRILLO" | "MATE" };
export type DatosPedidoBot = { renglones: RenglonBot[]; envio: { direccion: string } | null; nombre: string; email?: string | null };

export type ResumenPorCorreo = { email: string; nombre: string; numero: number; lineas: LineaCotizada[]; envio: number; total: number; sena: number; depositPct: number; linkSena: string; linkTotal: string; fechas: { plazo: Plazo; fecha: string }[] };
export type ChatDelPedido = { id: string; waId: string; clientId: string | null; nombre: string | null };

export type ResultadoPedidoBot =
  | { ok: true; numero: number; subtotal: number; envio: number; total: number; sena: number; depositPct: number; linkSena: string; linkTotal: string; lineas: LineaCotizada[]; fechas: { plazo: Plazo; fecha: string }[] }
  | { ok: false; motivo: "MODULO" | "SIN_MP" | "SIN_FOTOS" | "FOTO_NO_LISTA" | "PRECIO" | "SIN_LABORATORIO" | "ENVIO_LEJOS" | "SIN_DIRECCION" | "ERROR"; detalle?: string };

export type AbrirCobro = (d: { workspaceId: string; pedidoId: string; numero: number; montoCents: number; tipo: "SENA" | "TOTAL"; token: string; origen: string; slug: string; tracking: string }) => Promise<string>;

export type DepsPedidoBot = {
  db?: typeof prisma;
  ahora?: () => Date;
  moduloEncendido?: (workspaceId: string) => Promise<boolean>;
  /** El token de Mercado Pago del estudio, o null si no puede cobrar. */
  collector?: (workspaceId: string) => Promise<string | null>;
  ajustes?: (workspaceId: string) => Promise<{ depositPct: number; porKmArs: number; maxKm: number }>;
  productos?: (workspaceId: string) => Promise<ProductoDelCatalogo[]>;
  estudio?: (workspaceId: string) => Promise<Punto | null>;
  geocodificar?: (direccion: string) => Promise<Punto | null>;
  abrir?: AbrirCobro;
  /** Si el cliente dio su correo: el resumen del pedido con los dos links. */
  enviarResumen?: (workspaceId: string, d: ResumenPorCorreo) => Promise<void>;
  origen?: string;
  slug?: string;
};

const MAX_KM_ENVIO = 30;
const pesos = (n: number) => n.toFixed(2);
const no = (motivo: Extract<ResultadoPedidoBot, { ok: false }>["motivo"], detalle?: string): ResultadoPedidoBot => ({ ok: false, motivo, ...(detalle ? { detalle } : {}) });

function medidaEnCm(medida: string): { widthCm: number; heightCm: number } | null {
  const m = medida.match(/^(\d{1,3})x(\d{1,3})$/);
  return m ? { widthCm: Number(m[1]), heightCm: Number(m[2]) } : null;
}

const abrirConMercadoPago: AbrirCobro = async (d) => {
  const { createMercadoPagoCheckoutProLiveAdapter } = await import("@repo/payments/mercado-pago");
  const vuelta = (estado: string) => `${d.origen}/w/${encodeURIComponent(d.slug)}/impresion/${d.tracking}?pago=${estado}&pedido=${encodeURIComponent(d.pedidoId)}`;
  const pref = await createMercadoPagoCheckoutProLiveAdapter({}).createPreference({
    amountMinor: d.montoCents,
    currency: "ARS",
    description: `${d.tipo === "SENA" ? "Seña · " : ""}Copias impresas · pedido ${d.numero}`,
    externalReference: referenciaPedido(d.pedidoId),
    idempotencyKey: randomUUID(),
    successUrl: vuelta("ok"),
    pendingUrl: vuelta("pendiente"),
    failureUrl: vuelta("error"),
    notificationUrl: `${d.origen}/api/payments/mp/impresiones-webhook?ws=${encodeURIComponent(d.workspaceId)}`,
    accessTokenOverride: d.token,
    itemId: `impresion-${d.pedidoId}-${d.tipo.toLowerCase()}`,
    sourceApp: "FOTOFFICE",
    metadata: { pedidoId: d.pedidoId, workspaceId: d.workspaceId, cobro: d.tipo },
  });
  return pref.checkoutUrl;
};

async function porOmision(workspaceId: string): Promise<Required<Omit<DepsPedidoBot, "db" | "ahora" | "abrir" | "enviarResumen">>> {
  const [{ isModuleEnabledForWorkspace }, { PRINT_ORDERS_MODULE_KEY }, { resolveWorkspaceCollector }, { extrasDelWorkspace }, { coordenadasDelEstudio }, { geocodificarLugar }] =
    await Promise.all([
      import("@/lib/modules/gating"),
      import("./constantes"),
      import("@/lib/payments/connect/collector"),
      import("@/lib/presupuestos/perfil-cobro"),
      import("./envio"),
      import("@/lib/presupuesto-automatico/por-horas"),
    ]);
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { publicSlug: true } });
  return {
    moduloEncendido: (ws) => isModuleEnabledForWorkspace(ws, PRINT_ORDERS_MODULE_KEY),
    collector: async (ws) => {
      const c = await resolveWorkspaceCollector(ws);
      return c.ok ? c.collector.accessToken : null;
    },
    ajustes: async (ws) => {
      const s = (await prisma.fotofficePrintSettings.findUnique({ where: { workspaceId: ws } })) as
        | { depositPct?: number; shippingPerKmArs?: unknown; shippingMaxKm?: number | null }
        | null;
      const porKm = Number(s?.shippingPerKmArs ?? NaN);
      return { depositPct: s?.depositPct ?? 50, porKmArs: Number.isFinite(porKm) && porKm > 0 ? porKm : 3000, maxKm: s?.shippingMaxKm ?? MAX_KM_ENVIO };
    },
    productos: async (ws) => {
      const filas = await prisma.product.findMany({
        where: { workspaceId: ws, isActive: true },
        select: { id: true, name: true, priceArs: true, costArs: true, preferredProveedorId: true },
      });
      return filas.map((p) => ({ id: p.id, name: p.name, priceArs: Number(p.priceArs), costArs: p.costArs === null ? null : Number(p.costArs), preferredProveedorId: p.preferredProveedorId }));
    },
    estudio: async (ws) => {
      const [extras, b] = await Promise.all([
        extrasDelWorkspace(ws),
        prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId: ws }, select: { atencionDireccion: true, city: true } }),
      ]);
      return ubicarEstudio(coordenadasDelEstudio(extras as never), { atencionDireccion: b?.atencionDireccion ?? null, city: b?.city ?? null }, geocodificarLugar);
    },
    geocodificar: geocodificarLugar,
    origen: (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/+$/, ""),
    slug: branding?.publicSlug ?? "",
  };
}

/**
 * Desde dónde se calcula el envío: la ubicación del perfil de precios (Configuración → Precios) o, si
 * no está cargada, la dirección de atención del estudio ubicada en el mapa.
 */
export async function ubicarEstudio(
  delPerfil: Punto | null,
  branding: { atencionDireccion: string | null; city: string | null },
  geocodificar: (direccion: string) => Promise<Punto | null>,
): Promise<Punto | null> {
  if (delPerfil) return delPerfil;
  const dir = branding.atencionDireccion?.trim();
  if (!dir) return null;
  const ciudad = branding.city?.trim();
  return geocodificar(ciudad && !dir.toLowerCase().includes(ciudad.toLowerCase()) ? `${dir}, ${ciudad}` : dir).catch(() => null);
}

export async function crearPedidoDesdeWhatsapp(workspaceId: string, chat: ChatDelPedido, datos: DatosPedidoBot, deps: DepsPedidoBot = {}): Promise<ResultadoPedidoBot> {
  try {
    const d = { ...(deps.moduloEncendido && deps.collector ? {} : await porOmision(workspaceId)), ...deps } as Required<DepsPedidoBot>;
    const db = deps.db ?? prisma;
    const ahora = (deps.ahora ?? (() => new Date()))();
    const abrir = deps.abrir ?? abrirConMercadoPago;

    if (!(await d.moduloEncendido(workspaceId))) return no("MODULO");
    const token = await d.collector(workspaceId);
    if (!token || !d.origen || !d.slug) return no("SIN_MP");
    if (datos.renglones.length === 0 || datos.renglones.some((r) => r.fotos.length === 0)) return no("SIN_FOTOS");

    // Las fotos: mensajes del chat con el archivo ya bajado.
    const ids = [...new Set(datos.renglones.flatMap((r) => r.fotos.map((f) => f.mensajeId)))];
    const mensajes = (await db.fotofficeWaMensaje.findMany({
      where: { id: { in: ids }, chatId: chat.id, workspaceId, direccion: "ENTRANTE" },
      select: { id: true, tipo: true, media: true },
    })) as { id: string; tipo: string; media: unknown }[];
    const porId = new Map(mensajes.map((m) => [m.id, m]));
    for (const id of ids) if (!porId.get(id) || !claveDeMedia(porId.get(id)!.media)) return no("FOTO_NO_LISTA", id);

    // Precios del catálogo: cada foto × cantidad es una línea.
    const catalogo = leerProductosDeCopia(await d.productos(workspaceId));
    const lineasPedido = datos.renglones.flatMap((r) => r.fotos.map((f) => ({ r, f })));
    const cot = cotizarCopias(lineasPedido.map(({ r }) => ({ medida: r.medida, plazo: r.plazo, cantidad: r.cantidad })), catalogo);
    if (!cot.ok) return no("PRECIO", cot.falta);
    // Una copia de laboratorio sin laboratorio se cobraría y no saldría nunca: no se vende por el bot.
    const sinLab = cot.lineas.find((l) => l.plazo !== "INSTANTANEA" && !l.proveedorId);
    if (sinLab) return no("SIN_LABORATORIO", `${sinLab.medida} ${nombreDelPlazo(sinLab.plazo)}`);

    let envio: { km: number; pesos: number; direccion: string; punto: Punto } | null = null;
    if (datos.envio) {
      const direccion = datos.envio.direccion.trim().slice(0, 200);
      if (!direccion) return no("SIN_DIRECCION");
      const [estudio, destino, ajustes] = await Promise.all([d.estudio(workspaceId), d.geocodificar(direccion), d.ajustes(workspaceId)]);
      const c = cotizarEnvio({ estudio, destino, baseCents: 0, porKmCents: Math.round(ajustes.porKmArs * 100), maxKm: Math.min(ajustes.maxKm, MAX_KM_ENVIO) });
      if (!c.ok) return no(c.motivo === "FUERA_DE_RADIO" ? "ENVIO_LEJOS" : "SIN_DIRECCION");
      envio = { km: c.km, pesos: Math.round(c.cents / 10_000) * 100, direccion, punto: destino! };
    }

    const { depositPct } = await d.ajustes(workspaceId);
    const subtotal = cot.subtotal;
    const total = subtotal + (envio?.pesos ?? 0);
    const sena = Math.round((total * depositPct) / 100);
    const costo = cot.lineas.reduce((s, l) => s + (l.costoUnitario ?? 0) * l.cantidad, 0);

    const items = lineasPedido.map(({ r, f }, i) => {
      const linea = cot.lineas[i];
      const m = porId.get(f.mensajeId)!;
      const archivo = archivoDeMensaje(m.tipo, m.media);
      const cm = medidaEnCm(linea.medida)!;
      const calidad = archivo?.ancho && archivo.alto ? calidadParaMedida(archivo.ancho, archivo.alto, linea.medida) : null;
      return {
        sourceKey: claveDeMedia(m.media)!,
        sourceName: archivo?.nombre ?? "foto.jpg",
        widthCm: cm.widthCm,
        heightCm: cm.heightCm,
        quantity: linea.cantidad,
        unitPriceArs: pesos(linea.precioUnitario),
        unitCostArs: pesos(linea.costoUnitario ?? 0),
        cropX: 0,
        cropY: 0,
        cropW: 1,
        cropH: 1,
        proveedorId: linea.proveedorId,
        paper: r.papel,
        plazo: linea.plazo,
        sinRecorte: true,
        calidadBaja: calidad === "insuficiente",
      };
    });

    const nombre = (datos.nombre || chat.nombre || "Cliente de WhatsApp").trim().slice(0, 120);
    const email = typeof datos.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim()) ? datos.email.trim().slice(0, 254) : null;
    const pedido = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-impresion-numero:${workspaceId}`}))`;
      // Un pedido pendiente por chat: el nuevo reemplaza al anterior (si después lo pagan, no sale).
      await tx.fotofficePrintOrder.updateMany({
        where: { workspaceId, waChatId: chat.id, status: "PENDIENTE_PAGO" },
        data: { status: "CANCELADO", lastError: "REEMPLAZADO" },
      });
      const max = await tx.fotofficePrintOrder.aggregate({ where: { workspaceId }, _max: { number: true } });
      return tx.fotofficePrintOrder.create({
        data: {
          workspaceId,
          number: (max._max.number ?? 0) + 1,
          source: "WHATSAPP",
          clientId: chat.clientId,
          nombre,
          email,
          telefono: `+${chat.waId}`,
          paper: datos.renglones[0].papel,
          delivery: envio ? "ENVIO" : "RETIRO",
          subtotalArs: pesos(subtotal),
          shippingArs: pesos(envio?.pesos ?? 0),
          totalArs: pesos(total),
          ...(envio ? { shippingAddress: envio.direccion, shippingLat: envio.punto.lat, shippingLon: envio.punto.lon, shippingKm: envio.km } : {}),
          costTotalArs: pesos(costo),
          pricingSnapshot: { origen: "catalogo", ganancia: subtotal - costo, depositPct } as Prisma.InputJsonObject,
          trackingToken: randomBytes(18).toString("base64url"),
          depositArs: pesos(sena),
          waChatId: chat.id,
          waId: chat.waId,
          items: { create: items },
        },
        select: { id: true, number: true, trackingToken: true },
      });
    });

    const comun = { workspaceId, pedidoId: pedido.id, numero: pedido.number, token, origen: d.origen, slug: d.slug, tracking: pedido.trackingToken };
    const [linkSena, linkTotal] = await Promise.all([
      abrir({ ...comun, montoCents: Math.round(sena * 100), tipo: "SENA" }),
      abrir({ ...comun, montoCents: Math.round(total * 100), tipo: "TOTAL" }),
    ]);
    const plazos = [...new Set(cot.lineas.map((l) => l.plazo))];
    const fechas = plazos.map((plazo) => ({ plazo, fecha: fechaPorPlazo(plazo, ahora) }));
    if (email) {
      await (deps.enviarResumen ?? enviarResumenPorCorreo)(workspaceId, {
        email, nombre, numero: pedido.number, lineas: cot.lineas, envio: envio?.pesos ?? 0, total, sena, depositPct, linkSena, linkTotal, fechas,
      }).catch(() => console.warn("[impresiones] no salió el resumen por correo", { numero: pedido.number }));
    }
    return {
      ok: true,
      numero: pedido.number,
      subtotal,
      envio: envio?.pesos ?? 0,
      total,
      sena,
      depositPct,
      linkSena,
      linkTotal,
      lineas: cot.lineas,
      fechas,
    };
  } catch (e) {
    console.error("[impresiones] el bot no pudo armar el pedido", { codigo: (e as { code?: unknown } | null)?.code ?? (e instanceof Error ? e.name : "desconocido") });
    return no("ERROR");
  }
}

const precio = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
const ddmm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

/** El resumen del pedido por correo (si el cliente lo pidió): lo mismo que le pasa el bot, con los dos links. */
async function enviarResumenPorCorreo(workspaceId: string, d: ResumenPorCorreo): Promise<void> {
  const [{ sendTransactionalEmail }, { loadWorkspaceSender }, { esc }] = await Promise.all([
    import("@/lib/communications/send-email"),
    import("@/lib/communications/load-workspace-sender"),
    import("./correo-lab"),
  ]);
  const plazo = { INSTANTANEA: "instantánea", MANANA: "para mañana", SEMANA: "para la próxima semana" } as const;
  const lineas = d.lineas.map((l) => `${l.cantidad} × ${l.medida} ${plazo[l.plazo]}: ${precio(l.precioUnitario)} c/u`);
  const texto = [
    `¡Hola, ${d.nombre}!`,
    "",
    `Este es el resumen de tu pedido de copias N° ${d.numero}:`,
    ...lineas.map((l) => `- ${l}`),
    ...(d.envio > 0 ? [`- Envío: ${precio(d.envio)}`] : []),
    `Total: ${precio(d.total)}`,
    `Seña (${d.depositPct} %): ${precio(d.sena)}`,
    `Fechas si pagás hoy: ${d.fechas.map((f) => `${plazo[f.plazo]}, ${ddmm(f.fecha)}`).join("; ")}`,
    "",
    `Pagar la seña: ${d.linkSena}`,
    `Pagar el total: ${d.linkTotal}`,
    "",
    "Cuando pagues, el pedido sale a imprimir. Te esperamos en el estudio.",
  ].join("\n");
  await sendTransactionalEmail({
    to: d.email,
    sender: await loadWorkspaceSender(workspaceId),
    subject: `Tu pedido de copias N° ${d.numero}`,
    text: texto,
    html: texto
      .split("\n")
      .map((l) => (l.startsWith("Pagar la seña: ") ? `<p><a href="${esc(d.linkSena)}">Pagar la seña (${precio(d.sena)})</a></p>` : l.startsWith("Pagar el total: ") ? `<p><a href="${esc(d.linkTotal)}">Pagar el total (${precio(d.total)})</a></p>` : `<p>${esc(l)}</p>`))
      .join(""),
  });
}
