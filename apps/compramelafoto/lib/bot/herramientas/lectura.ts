import { defineTool, type BotTool } from "@repo/dnx-bot";
import { z } from "zod";
import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";
import { ALBUM_SALES_GAP_LABELS, evaluateAlbumSalesReadiness } from "@/lib/albums/album-sales-readiness";
import { getMercadoPagoConnectionHealth, needsMercadoPagoReconnect } from "@/lib/mercadopago/mp-connection-health";
import { prisma } from "@/lib/prisma";

const NOT_FOUND = { ok: false as const, code: "NOT_FOUND", message: "No encontré eso en tu cuenta." };

/**
 * Ruta del panel donde está el botón para conectar Mercado Pago.
 * Evidencia: app/fotografo/configuracion/ConfiguracionClient.tsx renderiza
 * <MercadoPagoIntegration ownerType="USER" />, que navega a /api/mercadopago/oauth/start.
 */
export const MP_CONNECT_PATH = "/fotografo/configuracion";

type StoredTutorial = { title?: unknown; youtubeUrl?: unknown };

function parseTutorials(value: string | null | undefined): { titulo: string; enlace: string }[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    const list = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown })?.items;
    if (!Array.isArray(list)) return [];
    return (list as StoredTutorial[])
      .filter((t) => t && typeof t.title === "string" && typeof t.youtubeUrl === "string")
      .map((t) => ({ titulo: t.title as string, enlace: t.youtubeUrl as string }));
  } catch {
    return [];
  }
}

export const lecturaTools: BotTool[] = [
  defineTool({
    name: "ver_album",
    description: "Detalle de un álbum del usuario: estado de venta, qué le falta para vender, precios, packs y vencimiento.",
    kind: "read",
    input: z.strictObject({ albumId: z.number().int().positive() }),
    run: async ({ albumId }, actor) => {
      const a = await prisma.album.findFirst({
        where: { id: albumId, userId: actor.userId, deletedAt: null },
        select: {
          id: true, title: true, isPublic: true, location: true, eventDate: true, expiresAt: true,
          enableDigitalPhotos: true, enablePrintedPhotos: true, digitalPhotoPriceCents: true,
          digitalDiscount5Plus: true, digitalDiscount10Plus: true, digitalDiscount20Plus: true,
          termsAcceptedAt: true, termsVersion: true, albumProfitMarginPercent: true, selectedLabId: true,
          pickupBy: true, printPricingSource: true, hiddenPhotosEnabled: true, hiddenSelfieRetentionDays: true,
          packs: { select: { id: true, name: true, price: true, isActive: true, includedPhotoCount: true } },
          _count: { select: { photos: { where: { isRemoved: false } } } },
        },
      });
      if (!a) return NOT_FOUND;
      const { _count, packs, ...album } = a;
      const r = evaluateAlbumSalesReadiness(a);
      return {
        ok: true,
        message: `Álbum «${a.title}»`,
        data: {
          ...album,
          fotos: _count.photos,
          precioDigital: a.digitalPhotoPriceCents != null ? formatPurchaseArs(a.digitalPhotoPriceCents) : null,
          ventaHabilitada: r.readyToSell,
          faltas: r.gaps.map((g) => ALBUM_SALES_GAP_LABELS[g]),
          packs: packs.map((p) => ({ ...p, precio: formatPurchaseArs(p.price) })),
        },
      };
    },
  }),
  defineTool({
    name: "buscar_pedidos",
    description: "Últimos pedidos de fotos de los álbumes del usuario. Opcional: filtrar por email del comprador o por álbum.",
    kind: "read",
    input: z.strictObject({ emailComprador: z.string().email().optional(), albumId: z.number().int().positive().optional() }),
    run: async ({ emailComprador, albumId }, actor) => {
      const rows = await prisma.order.findMany({
        where: {
          isTest: false,
          album: { userId: actor.userId },
          ...(albumId ? { albumId } : {}),
          ...(emailComprador ? { buyerEmail: emailComprador.toLowerCase() } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, status: true, totalCents: true, createdAt: true, albumId: true },
      });
      return {
        ok: true,
        message: `${rows.length} pedidos`,
        data: rows.map((o) => ({ ...o, total: formatPurchaseArs(o.totalCents) })),
      };
    },
  }),
  defineTool({
    name: "ver_pedido",
    description: "Estado de un pedido de un álbum del usuario: si está pagado, si se entregó y si el link de descarga sigue vigente.",
    kind: "read",
    input: z.strictObject({ orderId: z.number().int().positive() }),
    run: async ({ orderId }, actor) => {
      const o = await prisma.order.findFirst({
        where: { id: orderId, album: { userId: actor.userId } },
        select: {
          id: true, status: true, totalCents: true, buyerEmail: true, createdAt: true,
          digitalDeliveredAt: true, items: { select: { id: true } },
        },
      });
      if (!o) return NOT_FOUND;
      const token = await prisma.orderDownloadToken.findFirst({
        where: { orderId, type: "CLIENT_DIGITAL", photoId: null, expiresAt: { gt: new Date() } },
        select: { expiresAt: true },
      });
      return {
        ok: true,
        message: `Pedido #${o.id}`,
        data: {
          id: o.id,
          estado: o.status,
          total: formatPurchaseArs(o.totalCents),
          fotos: o.items.length,
          comprador: o.status === "PAID" ? o.buyerEmail : "(oculto hasta que se pague)",
          entregado: o.digitalDeliveredAt,
          linkVigenteHasta: token?.expiresAt ?? null,
        },
      };
    },
  }),
  defineTool({
    name: "estado_mercadopago",
    description: "Revisa si la cuenta de Mercado Pago del usuario está conectada y puede cobrar.",
    kind: "read",
    input: z.strictObject({}),
    run: async (_i, actor) => {
      const h = await getMercadoPagoConnectionHealth({ ownerType: "USER", ownerId: actor.userId });
      const msg =
        h.status === "CONNECTED"
          ? "Mercado Pago está conectado y puede cobrar."
          : needsMercadoPagoReconnect(h.status)
            ? `La conexión venció. Hay que reconectar desde ${MP_CONNECT_PATH}.`
            : h.status === "NOT_CONNECTED"
              ? `No hay cuenta conectada. Se conecta desde ${MP_CONNECT_PATH}.`
              : "No pude verificar la conexión ahora.";
      return { ok: true, message: msg, data: { estado: h.status, enlace: MP_CONNECT_PATH } };
    },
  }),
  defineTool({
    name: "ver_tutoriales",
    description: "Lista de tutoriales en video de CLF con su enlace de YouTube.",
    kind: "read",
    input: z.strictObject({}),
    run: async () => {
      const row = await prisma.systemSettings.findUnique({ where: { key: "tutorials_videos" } });
      const items = parseTutorials(row?.value);
      return { ok: true, message: `${items.length} tutoriales`, data: items };
    },
  }),
];
