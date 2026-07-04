import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/fotografo/pedidos
 *
 * Devuelve pedidos del fotógrafo autenticado. ANTIFRAUDE:
 * - Pedidos PAID: datos completos (cliente, items, etc.)
 * - Pedidos PENDING/FAILED: solo registro mínimo (id, total, estado, fecha) sin datos sensibles
 *
 * Incluye: PrintOrders donde photographerId = user O labId = lab del user (LAB_PHOTOGRAPHER);
 * Orders de álbumes donde es owner o colaborador (tiene fotos).
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
    const url = new URL(req.url);
    const debugMode = url.searchParams.get("debug") === "1";

    // Para LAB y LAB_PHOTOGRAPHER: incluir pedidos del laboratorio (flujo imprimir público tiene photographerId=null, labId=lab)
    let labId: number | null = null;
    if (user.role === Role.LAB_PHOTOGRAPHER || user.role === Role.LAB) {
      const lab = await prisma.lab.findUnique({
        where: { userId: id },
        select: { id: true },
      });
      if (lab) labId = lab.id;
    }

    const printOrderWhere: { photographerId?: number; labId?: number; OR?: Array<{ photographerId: number } | { labId: number }> } =
      labId != null
        ? { OR: [{ photographerId: id }, { labId }] }
        : { photographerId: id };

    const printOrders = await prisma.printOrder.findMany({
      where: printOrderWhere,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { items: true, lab: true },
    });

    const linkedAlbumOrderIds = new Set<number>();
    printOrders.forEach((o) => {
      const tags = Array.isArray(o.tags) ? o.tags : [];
      tags.forEach((tag) => {
        const match = String(tag).match(/^ALBUM_ORDER:(\d+)$/);
        if (match) {
          const id = Number(match[1]);
          if (Number.isFinite(id)) linkedAlbumOrderIds.add(id);
        }
      });
    });

    const printRows = printOrders.map((o) => {
      const isPaid = o.paymentStatus === "PAID";
      return {
        id: o.id,
        // Datos sensibles solo si está pagado
        customerName: isPaid ? o.customerName : "[Protegido hasta acreditación del pago]",
        customerEmail: isPaid ? o.customerEmail : "[Protegido]",
        customerPhone: isPaid ? o.customerPhone : "[Protegido]",
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
        orderType: "PRINT",
        source: "PRINT_ORDER",
        _dataProtected: !isPaid,
      };
    });

    const digitalOrders = await prisma.order.findMany({
      where: {
        OR: [
          { album: { userId: id } },
          { album: { photos: { some: { userId: id } } } },
        ],
        status: { in: ["PAID", "PENDING", "FAILED", "REFUNDED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { items: true, album: { select: { pickupBy: true } } },
    });

    const digitalRows = digitalOrders.map((o) => {
      const isPaid = o.status === "PAID";
      const hasPrintItems = o.items.some((it) => it.productType === "PRINT");
      const hasLinkedPrintOrder = hasPrintItems && linkedAlbumOrderIds.has(o.id);
      const showPrintInAlbum = hasPrintItems && !hasLinkedPrintOrder;
      const albumPickup = (o.album as { pickupBy?: string })?.pickupBy ?? "CLIENT";
      return {
        id: o.id,
        customerName: null,
        customerEmail: isPaid ? o.buyerEmail : "[Protegido]",
        customerPhone: null,
        pickupBy: showPrintInAlbum ? albumPickup : "DIGITAL",
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
        }).format(o.createdAt),
        createdAtIso: o.createdAt.toISOString(),
        itemsCount: o.items.length,
        currency: "ARS",
        total: Math.round(o.totalCents),
        status: o.status,
        orderType: "DIGITAL",
        source: "ALBUM_ORDER",
        hasPrintItems: showPrintInAlbum,
        albumPickupBy: albumPickup,
        downloadLinkViewedAt: o.downloadLinkViewedAt?.toISOString() ?? null,
        _dataProtected: !isPaid,
      };
    });

    const rows = [...printRows, ...digitalRows].sort((a, b) => {
      return String(b.createdAtIso).localeCompare(String(a.createdAtIso));
    });

    if (debugMode) {
      return NextResponse.json({
        rows,
        _debug: {
          userId: id,
          role: user.role,
          labId,
          counts: { print: printRows.length, digital: digitalRows.length },
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
