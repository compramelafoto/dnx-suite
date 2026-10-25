import { usuarioIncluyePruebas } from "@/lib/demos/visibilidad";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { getAlbumOrderFulfillmentFromItems } from "@/lib/order-fulfillment";
import { mapEventOrganizerCommissionRowToBreakdown } from "@/lib/event-organizer-commission-display";
import {
  resolveAlbumOrderBuyerName,
  resolveAlbumOrderBuyerPhone,
} from "@/lib/orders/resolve-album-order-buyer-contact";
import { digitalOrdersVisibilityWhere } from "@/lib/agencies/order-visibility";
import { esPedidoDemo } from "@/lib/canje-externo/pack-de-prueba";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAlbumMirrorPrintOrder(tags: unknown): boolean {
  const t = Array.isArray(tags) ? tags : [];
  return t.some((tag) => String(tag).startsWith("ALBUM_ORDER:"));
}

/**
 * GET /api/fotografo/pedidos
 *
 * Devuelve pedidos del fotógrafo autenticado. ANTIFRAUDE:
 * - Pedidos PAID: datos completos (cliente, items, etc.)
 * - Pedidos PENDING/FAILED: solo registro mínimo (id, total, estado, fecha) sin datos sensibles
 *
 * Incluye: PrintOrders (no espejo de álbum) donde photographerId = user O labId = lab del user;
 * Orders de álbumes donde es owner o colaborador. Los PrintOrder espejo (tag ALBUM_ORDER) no se listan:
 * el pedido de álbum consolidado muestra acciones digitales + impresión.
 */
export async function GET(req: Request) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.LAB]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Iniciá sesión como fotógrafo." },
        { status: 401 }
      );
    }

    const id = user.id;
    // Demos grabables: el fotógrafo demo ve sus pedidos de prueba como pedidos normales.
    const verPruebas = await usuarioIncluyePruebas(id);
    const canRevealClientBeforePaid = user.allowUnpaidOrderClientData === true;
    const photographerProfile = await prisma.user.findUnique({
      where: { id },
      select: { instagram: true },
    });
    const photographerInstagram = photographerProfile?.instagram ?? null;
    const url = new URL(req.url);
    const debugMode = url.searchParams.get("debug") === "1";

    let labId: number | null = null;
    if (user.role === Role.LAB_PHOTOGRAPHER || user.role === Role.LAB) {
      const lab = await prisma.lab.findUnique({
        where: { userId: id },
        select: { id: true },
      });
      if (lab) labId = lab.id;
    }

    const printOrderWhere: {
      photographerId?: number;
      labId?: number;
      OR?: Array<{ photographerId: number } | { labId: number }>;
    } =
      labId != null
        ? { OR: [{ photographerId: id }, { labId }] }
        : { photographerId: id };

    const printOrdersRaw = await prisma.printOrder.findMany({
      where: printOrderWhere,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { items: true, lab: true },
    });

    const printRows = printOrdersRaw
      .filter((o) => !isAlbumMirrorPrintOrder(o.tags))
      .map((o) => {
        const isPaid = o.paymentStatus === "PAID";
        const reveal = isPaid || canRevealClientBeforePaid;
        return {
          id: o.id,
          customerName: reveal ? o.customerName : "[Protegido hasta acreditación del pago]",
          customerEmail: reveal ? o.customerEmail : "[Protegido]",
          customerPhone: reveal ? o.customerPhone : "[Protegido]",
          pickupBy: o.pickupBy,
          labName: o.lab?.name ?? "Fotógrafo (sin laboratorio)",
          createdAtText: new Intl.DateTimeFormat("es-AR", {
            dateStyle: "short",
            timeStyle: "medium",
            timeZone: "America/Argentina/Buenos_Aires",
          }).format(o.createdAt),
          statusUpdatedAtText: new Intl.DateTimeFormat("es-AR", {
            dateStyle: "short",
            timeStyle: "medium",
            timeZone: "America/Argentina/Buenos_Aires",
          }).format(o.statusUpdatedAt),
          createdAtIso: o.createdAt.toISOString(),
          itemsCount: o.items.length,
          currency: o.currency,
          total: o.total,
          status: o.status,
          paymentStatus: o.paymentStatus ?? null,
          fulfillmentKind: "PRINT" as const,
          orderType: "PRINT",
          source: "PRINT_ORDER" as const,
          hasDigitalItems: false,
          hasPrintItems: true,
          digitalItemsCount: 0,
          printItemsCount: o.items.length,
          downloadLinkViewedAt: null as string | null,
          _dataProtected: !reveal,
          photographerInstagram,
        };
      });

    const digitalOrders = await prisma.order.findMany({
      where: {
        AND: [
          digitalOrdersVisibilityWhere(id),
          {
            // Pedidos de prueba fuera, salvo el canje que hace el fotógrafo con "Probar como
            // cliente": ése se lista como DEMO, en $0, y queda fuera de todo total.
            OR: verPruebas
              ? [{ isTest: false }, { isTest: true }]
              : [{ isTest: false }, { isTest: true, origin: "PACK_REDEMPTION" }],
          },
        ],
        status: { in: ["PAID", "PENDING", "FAILED", "REFUNDED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        items: true,
        // Los videos van en su propia tabla: sin esto, un pedido de sólo
        // video le aparecía al fotógrafo como "0 ítems".
        videoItems: { select: { videoId: true, videoTitle: true } },
        album: { select: { pickupBy: true, eventId: true } },
        buyerUser: { select: { name: true, phone: true, whatsapp: true } },
      },
    });

    // Diseños armados en el pedido (el librito del canje): el fotógrafo los abre desde el pedido.
    const designsByOrderId = new Map<number, number[]>();
    const preventaOrderIds = digitalOrders.filter((o) => o.origin === "PACK_REDEMPTION").map((o) => o.id);
    if (preventaOrderIds.length > 0) {
      const designs = await prisma.designProject.findMany({
        where: { albumOrderId: { in: preventaOrderIds } },
        select: { id: true, albumOrderId: true },
        orderBy: { id: "asc" },
      });
      for (const d of designs) {
        if (d.albumOrderId == null) continue;
        designsByOrderId.set(d.albumOrderId, [...(designsByOrderId.get(d.albumOrderId) ?? []), d.id]);
      }
    }

    const paidAlbumOrderIds = digitalOrders
      .filter((o) => o.status === "PAID" && (!o.isTest || verPruebas))
      .map((o) => o.id);
    const organizerCommissionByOrderId = new Map<
      number,
      ReturnType<typeof mapEventOrganizerCommissionRowToBreakdown>
    >();
    if (paidAlbumOrderIds.length > 0) {
      const commissionRows = await prisma.eventOrganizerCommission.findMany({
        where: { orderId: { in: paidAlbumOrderIds } },
        include: { event: { select: { title: true } } },
      });
      for (const row of commissionRows) {
        organizerCommissionByOrderId.set(row.orderId, mapEventOrganizerCommissionRowToBreakdown(row));
      }
    }

    const mirrorPhoneByAlbumOrderId = new Map<number, string>();
    const albumOrderIdsMissingPhone = digitalOrders
      .filter((o) => {
        const f = getAlbumOrderFulfillmentFromItems(o.items);
        return f.hasPrintItems && !resolveAlbumOrderBuyerPhone(o, o.buyerUser);
      })
      .map((o) => o.id);
    if (albumOrderIdsMissingPhone.length > 0) {
      const mirrorTags = albumOrderIdsMissingPhone.map((orderId) => `ALBUM_ORDER:${orderId}`);
      const mirrors = await prisma.printOrder.findMany({
        where: { OR: mirrorTags.map((tag) => ({ tags: { has: tag } })) },
        select: { tags: true, customerPhone: true },
      });
      for (const mirror of mirrors) {
        const phone = mirror.customerPhone?.trim();
        if (!phone) continue;
        const tags = Array.isArray(mirror.tags) ? mirror.tags : [];
        for (const tag of tags) {
          const match = String(tag).match(/^ALBUM_ORDER:(\d+)$/);
          if (match) {
            mirrorPhoneByAlbumOrderId.set(Number(match[1]), phone);
          }
        }
      }
    }

    const albumRows = digitalOrders.map((o) => {
      const isPaid = o.status === "PAID";
      const reveal = isPaid || canRevealClientBeforePaid;
      const f = getAlbumOrderFulfillmentFromItems(o.items);
      const albumPickup = (o.album as { pickupBy?: string })?.pickupBy ?? "CLIENT";
      const buyerName = resolveAlbumOrderBuyerName(o, o.buyerUser);
      const buyerPhone =
        resolveAlbumOrderBuyerPhone(o, o.buyerUser) ??
        mirrorPhoneByAlbumOrderId.get(o.id) ??
        null;
      const isDemo = esPedidoDemo(o) && !verPruebas;
      const eventOrganizerSale = isDemo ? null : (organizerCommissionByOrderId.get(o.id) ?? null);
      const orderTotal = isDemo ? 0 : Math.round(o.totalCents);
      const photographerReceivedAmount =
        eventOrganizerSale?.photographerNetAmount ?? orderTotal;
      return {
        id: o.id,
        customerName: reveal
          ? buyerName
          : "[Protegido hasta acreditación del pago]",
        customerEmail: reveal ? o.buyerEmail : "[Protegido]",
        customerPhone: reveal
          ? buyerPhone
          : "[Protegido]",
        pickupBy: f.hasPrintItems ? albumPickup : "DIGITAL",
        labName: "-",
        createdAtText: new Intl.DateTimeFormat("es-AR", {
          dateStyle: "short",
          timeStyle: "medium",
          timeZone: "America/Argentina/Buenos_Aires",
        }).format(o.createdAt),
        statusUpdatedAtText: new Intl.DateTimeFormat("es-AR", {
          dateStyle: "short",
          timeStyle: "medium",
          timeZone: "America/Argentina/Buenos_Aires",
        }).format(o.updatedAt),
        createdAtIso: o.createdAt.toISOString(),
        itemsCount: o.items.length + (o.videoItems?.length ?? 0),
        videoItemsCount: o.videoItems?.length ?? 0,
        currency: "ARS",
        total: orderTotal,
        photographerReceivedAmount,
        clientPaidAmount: orderTotal,
        eventOrganizerSale,
        albumEventId: (o.album as { eventId?: number | null })?.eventId ?? null,
        status: o.status,
        paymentStatus: null as string | null,
        fulfillmentKind: f.kind,
        orderType:
          o.origin === "PREVENTA_PACK" || o.origin === "PACK_REDEMPTION"
            ? "PREVENTA"
            : f.kind,
        origin: o.origin ?? null,
        source: "ALBUM_ORDER" as const,
        hasDigitalItems: f.hasDigitalItems,
        hasPrintItems: f.hasPrintItems,
        digitalItemsCount: f.digitalItemsCount,
        printItemsCount: f.printItemsCount,
        albumPickupBy: albumPickup,
        downloadLinkViewedAt: o.downloadLinkViewedAt?.toISOString() ?? null,
        _dataProtected: !reveal,
        photographerInstagram,
        isDemo,
        designProjectIds: designsByOrderId.get(o.id) ?? [],
      };
    });

    const rows = [...printRows, ...albumRows].sort((a, b) => {
      return String(b.createdAtIso).localeCompare(String(a.createdAtIso));
    });

    if (debugMode) {
      return NextResponse.json({
        rows,
        _debug: {
          userId: id,
          role: user.role,
          labId,
          counts: { print: printRows.length, album: albumRows.length },
        },
      });
    }

    return NextResponse.json(rows, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/fotografo/pedidos ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo pedidos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
