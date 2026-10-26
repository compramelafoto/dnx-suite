import { defineTool, type BotTool, type ToolOutcome } from "@repo/dnx-bot";
import { z } from "zod";
import { computeAlbumHideAt, computeAlbumPurgeAt } from "@/lib/album-cleanup/eligibility";
import { fechaAvisoFotosListas } from "@/lib/preventa-canjeable/aviso-fotos-listas";
import { publicAlbumFilter } from "@/lib/album-helpers";
import { albumPhotoFileKey } from "@/lib/album-photo-ref";
import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";
import { albumConOriginales } from "@/lib/digital-download/reenviar-descarga";
import { albumOrderCanRetryPayment } from "@/lib/mercadopago/album-order-payment-recovery";
import { normalizeEmail } from "@/lib/order-claims";
import { listActivePacksForPublicCatalog } from "@/lib/preventa-canjeable/pack-service";
import { parsePreventaPackSnapshotV1 } from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import { buildDigitalBulkDiscountBenefitsLabel, getDigitalBulkDiscountPercent } from "@/lib/pricing/digital-bulk-discount";
import { computeCheckoutTotals } from "@/lib/pricing/pricing-engine";
import { prisma } from "@/lib/prisma";
import type { CompradorActor } from "../identidad";
import { etiquetaEstadoPedido } from "../mascara";
import { enlaceAlbum, enlaceReintento } from "../rutas";
import { albumVisiblePara } from "./visibilidad";

const ZONA_AR = "America/Argentina/Buenos_Aires";
const FECHA_AR = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA_AR, day: "2-digit", month: "2-digit", year: "numeric" });
const DIA_MES_AR = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA_AR, day: "2-digit", month: "2-digit" });

/** "12/10/2026" en hora argentina. */
export function fechaAR(d: Date): string {
  return FECHA_AR.format(d);
}

function diaMesAR(d: Date): string {
  return DIA_MES_AR.format(d);
}

const ALBUM_NO_ENCONTRADO = { ok: false as const, message: "No encontré ese álbum." };
const PEDIDO_NO_ENCONTRADO = { ok: false as const, message: "No encontré ese pedido." };
const ACLARACION_COTIZACION = "Es el total de fotos digitales; si el álbum tiene precios distintos por foto puede variar un poco.";

const albumId = z.number().int().positive();

/** Total de `cantidad` fotos digitales con el mismo cálculo del checkout (recargo incluido, en pesos). */
async function cotizar(id: number, fotos: { id: number }[]): Promise<number> {
  const totals = await computeCheckoutTotals({
    flow: "ALBUM_ORDER",
    albumId: id,
    items: fotos.map((f) => ({ fileKey: albumPhotoFileKey(f.id), tipo: "digital" as const, quantity: 1 })),
  });
  return totals.displayTotalCents;
}

function primerasFotos(id: number, cantidad: number) {
  return prisma.photo.findMany({
    where: { albumId: id, isRemoved: false },
    select: { id: true },
    orderBy: { id: "asc" },
    take: cantidad,
  });
}

function nombreFotografo(u: { name: string | null; companyName: string | null } | null | undefined): string | null {
  return u?.companyName || u?.name || null;
}

function buscarAlbum(): BotTool {
  return defineTool({
    name: "buscar_album",
    description: "Busca álbumes públicos por nombre del evento, lugar o fotógrafo. Devuelve hasta 5 con su enlace.",
    kind: "read",
    input: z.strictObject({ texto: z.string().min(3).max(80) }),
    run: async ({ texto }) => {
      const contiene = { contains: texto, mode: "insensitive" as const };
      const albumes = await prisma.album.findMany({
        where: {
          ...publicAlbumFilter(),
          isTest: false,
          deletedAt: null,
          OR: [{ title: contiene }, { location: contiene }, { user: { name: contiene } }, { user: { companyName: contiene } }],
        },
        select: { id: true, title: true, publicSlug: true, location: true, eventDate: true, user: { select: { name: true, companyName: true } } },
        take: 5,
        orderBy: { createdAt: "desc" },
      });
      if (albumes.length === 0) {
        return { ok: true, message: "No encontré álbumes públicos con ese nombre.", data: { albumes: [] } };
      }
      return {
        ok: true,
        message: `Encontré ${albumes.length} álbum(es).`,
        data: {
          albumes: albumes.map((al) => ({
            albumId: al.id,
            titulo: al.title,
            fotografo: nombreFotografo(al.user),
            fecha: al.eventDate ? fechaAR(al.eventDate) : null,
            lugar: al.location,
            enlace: enlaceAlbum(al),
          })),
        },
      };
    },
  });
}

function verAlbum(a: CompradorActor): BotTool {
  return defineTool({
    name: "ver_album",
    description:
      "Detalle de un álbum para comprar: si está disponible, cuántas fotos tiene, precio por foto digital (el mismo del checkout), descuentos por cantidad, packs y si las fotos están ocultas.",
    kind: "read",
    input: z.strictObject({ albumId }),
    run: async ({ albumId: id }) => {
      const album = await prisma.album.findFirst({
        where: { id, isTest: false },
        select: {
          id: true, title: true, isPublic: true, isHidden: true, deletedAt: true, cleanupStatus: true,
          firstPhotoDate: true, expirationExtensionDays: true,
          publicSlug: true, hiddenPhotosEnabled: true, enablePrintedPhotos: true,
          digitalDiscount5Plus: true, digitalDiscount10Plus: true, digitalDiscount20Plus: true,
          user: { select: { name: true, companyName: true } },
        },
      });
      if (!album || !albumVisiblePara(a, album)) return ALBUM_NO_ENCONTRADO;

      const ahora = new Date();
      // Mismos plazos que la página y la limpieza: desde la primera foto (no `expiresAt`, que nace en la creación).
      const visibleHasta = computeAlbumHideAt(album);
      const borradoEl = computeAlbumPurgeAt(album);
      const estado = !albumConOriginales(album)
        ? "ya no está disponible"
        : !visibleHasta || !borradoEl
          ? "disponible"
          : visibleHasta.getTime() > ahora.getTime()
            ? `disponible hasta el ${diaMesAR(visibleHasta)}`
            : borradoEl.getTime() > ahora.getTime()
              ? `venció el ${diaMesAR(visibleHasta)}; se puede pedir una extensión hasta el ${diaMesAR(borradoEl)}`
              : "ya no está disponible";

      const [fotos, preventa, packs] = await Promise.all([
        prisma.photo.count({ where: { albumId: id, isRemoved: false } }),
        listActivePacksForPublicCatalog(id),
        prisma.albumPack.findMany({ where: { albumId: id, isActive: true }, select: { name: true } }),
      ]);

      let precioPorFotoDigital: string | null = null;
      if (fotos > 0) {
        const una = await primerasFotos(id, 1);
        const total = una.length > 0 ? await cotizar(id, una) : 0;
        if (total > 0) precioPorFotoDigital = formatPurchaseArs(total);
      }

      return {
        ok: true,
        message: `Álbum «${album.title}»`,
        data: {
          albumId: album.id,
          titulo: album.title,
          fotografo: nombreFotografo(album.user),
          estado,
          fotos,
          precioPorFotoDigital,
          descuentos: buildDigitalBulkDiscountBenefitsLabel(album),
          packsPreventa: preventa.map((p) => ({ nombre: p.name, precio: formatPurchaseArs(p.priceClientArs), beneficios: p.benefits.length })),
          packsDelAlbum:
            packs.length > 0 ? { nombres: packs.map((p) => p.name), precio: "el precio lo ves en el álbum al elegirlo" } : null,
          fotosOcultas: album.hiddenPhotosEnabled,
          ...(album.hiddenPhotosEnabled
            ? { comoVerLasFotos: "las fotos se ven después de verificarse con una selfie, desde el botón del álbum" }
            : {}),
          impresas: album.enablePrintedPhotos,
          enlace: enlaceAlbum(album),
        },
      };
    },
  });
}

function cotizarFotos(a: CompradorActor): BotTool {
  return defineTool({
    name: "cotizar_fotos",
    description: "Calcula cuánto salen N fotos digitales de un álbum con el mismo cálculo del checkout (incluye descuentos por cantidad y recargos).",
    kind: "read",
    input: z.strictObject({ albumId, cantidad: z.number().int().min(1).max(100) }),
    run: async ({ albumId: id, cantidad }) => {
      const album = await prisma.album.findFirst({
        where: { id, isTest: false },
        select: { id: true, isPublic: true, isHidden: true, digitalDiscount5Plus: true, digitalDiscount10Plus: true, digitalDiscount20Plus: true },
      });
      if (!album || !albumVisiblePara(a, album)) return ALBUM_NO_ENCONTRADO;
      const fotos = await primerasFotos(id, cantidad);
      if (fotos.length < cantidad) return { ok: false, message: `El álbum tiene ${fotos.length} fotos.` };
      const total = await cotizar(id, fotos);
      return {
        ok: true,
        message: ACLARACION_COTIZACION,
        data: { cantidad, total: formatPurchaseArs(total), descuentoPorcentaje: getDigitalBulkDiscountPercent(cantidad, album) },
      };
    },
  });
}

function estadoDePago(a: CompradorActor): BotTool {
  return defineTool({
    name: "estado_de_pago",
    description:
      "Estado de pago de un pedido por su número. Con el mail de la compra (o si la persona ya verificó su mail) da el enlace para volver a pagar si quedó pendiente o rechazado.",
    kind: "read",
    input: z.strictObject({ pedido: z.number().int().positive(), email: z.string().email().optional() }),
    run: async ({ pedido, email }) => {
      const o = await prisma.order.findFirst({
        where: { id: pedido, isTest: false },
        select: {
          status: true, albumId: true, buyerEmail: true, buyerUserId: true, origin: true, checkoutPaymentSource: true,
          isTest: true, createdAt: true, totalCents: true, album: { select: { title: true } },
        },
      });
      if (!o) return PEDIDO_NO_ENCONTRADO;
      const mailDelPedido = normalizeEmail(o.buyerEmail);
      // El orderId de la página de pago no prueba nada: sólo el enlace (descarga/pack), el mail verificado o la sesión.
      const verificado = a.emailVerificado ? normalizeEmail(a.emailVerificado) : null;
      const propio =
        (verificado != null && verificado === mailDelPedido) ||
        (a.userId != null && a.userId === o.buyerUserId) ||
        a.enlace?.orderId === pedido;
      const mailCoincide = email != null && normalizeEmail(email) === mailDelPedido;
      const data: Record<string, unknown> = { pedido, estado: etiquetaEstadoPedido(o.status) };
      if (propio) {
        data.fecha = fechaAR(o.createdAt);
        data.total = formatPurchaseArs(o.totalCents);
        data.album = o.album?.title ?? null;
      }
      if ((propio || mailCoincide) && albumOrderCanRetryPayment(o)) data.reintentar = enlaceReintento(pedido);
      return { ok: true, message: `Pedido #${pedido}: ${data.estado}`, data };
    },
  });
}

function misPedidos(a: CompradorActor): BotTool {
  return defineTool({
    name: "mis_pedidos",
    description: "Últimos 10 pedidos de la persona (requiere mail verificado): álbum, fecha, estado, total y si la descarga sigue vigente.",
    kind: "read",
    input: z.strictObject({}),
    run: async (): Promise<ToolOutcome> => {
      const email = a.emailVerificado ? normalizeEmail(a.emailVerificado) : null;
      const userId = a.userId;
      if (!email && !userId) return { ok: false, message: "Para ver tus pedidos primero verificá tu mail: pedime un código." };
      const pedidos = await prisma.order.findMany({
        where: {
          isTest: false,
          OR: [
            ...(email ? [{ buyerEmail: { equals: email, mode: "insensitive" as const } }] : []),
            ...(userId ? [{ buyerUserId: userId }] : []),
          ],
        },
        select: { id: true, status: true, totalCents: true, createdAt: true, album: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      if (pedidos.length === 0) return { ok: true, message: "No encontré pedidos con tu mail.", data: { pedidos: [] } };

      const tokens = await prisma.orderDownloadToken.findMany({
        where: { orderId: { in: pedidos.map((p) => p.id) }, type: "CLIENT_DIGITAL", photoId: null },
        select: { orderId: true, expiresAt: true },
      });
      const vence = new Map<number, Date>();
      for (const t of tokens) {
        if (t.orderId == null) continue;
        const actual = vence.get(t.orderId);
        if (!actual || t.expiresAt > actual) vence.set(t.orderId, t.expiresAt);
      }
      const ahora = Date.now();
      return {
        ok: true,
        message: `Tus últimos ${pedidos.length} pedido(s).`,
        data: {
          pedidos: pedidos.map((p) => {
            const v = vence.get(p.id);
            return {
              pedido: p.id,
              album: p.album?.title ?? null,
              fecha: fechaAR(p.createdAt),
              estado: etiquetaEstadoPedido(p.status),
              total: formatPurchaseArs(p.totalCents),
              descarga: !v ? "no corresponde" : v.getTime() > ahora ? `vigente hasta ${diaMesAR(v)}` : "vencida",
            };
          }),
        },
      };
    },
  });
}

function verMiDescarga(a: CompradorActor): BotTool {
  return defineTool({
    name: "ver_mi_descarga",
    description: "Estado del pedido del enlace de descarga que la persona tiene abierto: fotos, videos, vigencia del enlace y si el ZIP está listo.",
    kind: "read",
    input: z.strictObject({}),
    run: async () => {
      const orderId = a.enlace?.tipo === "descarga" ? a.enlace.orderId : null;
      if (orderId == null) return PEDIDO_NO_ENCONTRADO;
      const o = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true, status: true,
          album: { select: { title: true, deletedAt: true, cleanupStatus: true } },
          _count: { select: { items: true, videoItems: true } },
        },
      });
      if (!o) return PEDIDO_NO_ENCONTRADO;
      const [token, zip] = await Promise.all([
        prisma.orderDownloadToken.findFirst({
          where: { orderId, type: "CLIENT_DIGITAL", photoId: null },
          orderBy: { expiresAt: "desc" },
          select: { expiresAt: true },
        }),
        prisma.zipGenerationJob.findFirst({
          where: { orderId, type: "ORDER_DOWNLOAD" },
          orderBy: { createdAt: "desc" },
          select: { status: true },
        }),
      ]);
      const vigencia = !token
        ? "sin enlace"
        : token.expiresAt.getTime() > Date.now()
          ? `vigente hasta ${diaMesAR(token.expiresAt)}`
          : "vencido";
      const estadoZip = zip?.status === "COMPLETED" ? "listo" : zip?.status === "FAILED" ? "falló" : "se está preparando";
      return {
        ok: true,
        message: `Pedido #${o.id}`,
        data: {
          pedido: o.id,
          estado: etiquetaEstadoPedido(o.status),
          album: o.album?.title ?? null,
          originales: o.album ? albumConOriginales(o.album) : false,
          fotos: o._count.items,
          videos: o._count.videoItems,
          vigencia,
          zip: estadoZip,
        },
      };
    },
  });
}

function datosDelSnapshot(raw: unknown): { pack: string | null; fechaLimiteCanje: string | null } {
  try {
    const s = parsePreventaPackSnapshotV1(raw);
    const limite = s.redemptionDeadlineAt ? new Date(s.redemptionDeadlineAt) : null;
    return { pack: s.packName, fechaLimiteCanje: limite && !Number.isNaN(limite.getTime()) ? fechaAR(limite) : null };
  } catch {
    return { pack: null, fechaLimiteCanje: null };
  }
}

function verMiPack(a: CompradorActor): BotTool {
  return defineTool({
    name: "ver_mi_pack",
    description: "Estado del pack de preventa del enlace que la persona tiene abierto: si ya puede elegir fotos, si ya canjeó y la fecha límite.",
    kind: "read",
    input: z.strictObject({}),
    run: async () => {
      const orderId = a.enlace?.tipo === "pack" ? a.enlace.orderId : null;
      if (orderId == null) return PEDIDO_NO_ENCONTRADO;
      const o = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true, status: true, origin: true, albumId: true, redemptionOrderId: true, preventaPackSnapshotJson: true,
          redemptionPaymentRefsJson: true,
        },
      });
      if (!o || o.origin !== "PREVENTA_PACK") return PEDIDO_NO_ENCONTRADO;
      const fotos = await prisma.photo.count({ where: { albumId: o.albumId, isRemoved: false } });
      const canjeado = o.redemptionOrderId != null;
      const hayFotos = fotos > 0;
      // Las fotos se suben curso por curso: que el álbum tenga fotos no quiere decir que estén
      // las de este alumno. Lo dice el aviso del fotógrafo, que se manda por curso.
      const avisoRecibido = fechaAvisoFotosListas(o.redemptionPaymentRefsJson) != null;
      const siguientePaso = canjeado
        ? "Ya elegiste tus fotos."
        : !hayFotos
          ? "Todavía no hay fotos. Cuando el fotógrafo las suba y mande el aviso, vas a poder elegir desde este mismo enlace."
          : avisoRecibido
            ? "Ya podés elegir tus fotos desde este enlace."
            : "El fotógrafo está subiendo las fotos y todavía no avisó que están las de este curso. Si no encontrás al alumno, lo más probable es que su curso todavía no esté cargado: cuando esté, llega un mail y elegís desde este mismo enlace.";
      return {
        ok: true,
        message: `Pack del pedido #${o.id}`,
        data: {
          pedido: o.id,
          estado: etiquetaEstadoPedido(o.status),
          ...datosDelSnapshot(o.preventaPackSnapshotJson),
          canjeado,
          hayFotos,
          avisoRecibido,
          siguientePaso,
        },
      };
    },
  });
}

/**
 * Herramientas de consulta del comprador. Todas leen `a` dentro de `run`: si la persona
 * verifica su mail a mitad de turno, `mis_pedidos` ya funciona sin rearmar la lista.
 */
export function herramientasDeLectura(a: CompradorActor): BotTool[] {
  return [
    buscarAlbum(),
    verAlbum(a),
    cotizarFotos(a),
    estadoDePago(a),
    misPedidos(a),
    ...(a.enlace?.tipo === "descarga" ? [verMiDescarga(a)] : []),
    ...(a.enlace?.tipo === "pack" ? [verMiPack(a)] : []),
  ];
}
