import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { logAdminAction, getRequestMetadata } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AlbumSummary = {
  id: number;
  title: string;
  publicSlug: string | null;
  createdAt: Date;
  firstPhotoDate: Date | null;
  isHidden: boolean;
  isPublic: boolean;
  expirationExtensionDays: number;
  user: { id: number; name: string | null; email: string | null };
  _count: { photos: number; orders: number; interests: number };
};

function computeDates(album: AlbumSummary) {
  const baseDate = album.firstPhotoDate ?? album.createdAt;
  const extensionDays = album.expirationExtensionDays ?? 0;
  const visibleUntil = new Date(baseDate.getTime() + (30 + extensionDays) * 24 * 60 * 60 * 1000);
  const availableUntil = new Date(baseDate.getTime() + (45 + extensionDays) * 24 * 60 * 60 * 1000);
  return { visibleUntil, availableUntil };
}

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const visibility = searchParams.get("visibility");
    const q = searchParams.get("q")?.trim() || "";

    const where: any = {};
    if (status === "ACTIVE") where.isHidden = false;
    if (status === "INACTIVE") where.isHidden = true;
    if (visibility === "private") where.isPublic = false;
    if (visibility === "public") where.isPublic = true;
    // deletedAt puede no existir en la DB si la migración no se aplicó
    if (status === "DELETED") where.deletedAt = { not: null };
    else where.deletedAt = null;

    const whereWithoutDeletedAt = () => {
      const w = { ...where };
      delete w.deletedAt;
      return w;
    };

    if (q) {
      const qNum = parseInt(q);
      if (!isNaN(qNum)) {
        where.id = qNum;
      } else {
        where.OR = [
          { title: { contains: q, mode: "insensitive" } },
          { publicSlug: { contains: q, mode: "insensitive" } },
        ];
      }
    }

    let albums: AlbumSummary[] = [];
    let orderMap = new Map<number, { revenueCents: number; ordersCount: number }>();
    try {
      try {
        albums = (await prisma.album.findMany({
          where,
          select: {
            id: true,
            title: true,
            publicSlug: true,
            createdAt: true,
            firstPhotoDate: true,
            isHidden: true,
            isPublic: true,
            expirationExtensionDays: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                photos: true,
                orders: true,
                interests: true,
              },
            },
          } as any,
          orderBy: { createdAt: "desc" },
          take: 500,
        })) as unknown as AlbumSummary[];
      } catch (selectErr: any) {
        const msg = String(selectErr?.message ?? "");
        const missingColumn =
          msg.includes("expirationExtensionDays") ||
          msg.includes("isPublic") ||
          msg.includes("deletedAt") ||
          msg.includes("Unknown field") ||
          msg.includes("Unknown column") ||
          msg.includes("does not exist");
        if (!missingColumn) throw selectErr;
        const fallbackWhere = msg.includes("deletedAt") ? whereWithoutDeletedAt() : where;
        const fallback = await prisma.album.findMany({
          where: fallbackWhere,
          select: {
            id: true,
            title: true,
            publicSlug: true,
            createdAt: true,
            firstPhotoDate: true,
            isHidden: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                photos: true,
                orders: true,
                interests: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        });
        albums = fallback.map((a) => ({ ...a, expirationExtensionDays: 0, isPublic: true })) as AlbumSummary[];
      }

      const albumIds = albums.map((a) => a.id);
      const orderAggregates = albumIds.length
        ? await prisma.order.groupBy({
            by: ["albumId"],
            where: { albumId: { in: albumIds } },
            _sum: { totalCents: true },
            _count: { _all: true },
            _max: { createdAt: true },
          })
        : [];

      for (const row of orderAggregates) {
        orderMap.set(row.albumId, {
          revenueCents: row._sum.totalCents ?? 0,
          ordersCount: row._count._all ?? 0,
        });
      }
    } catch (dbErr: any) {
      const msg = String(dbErr?.message ?? "");
      const missingTable =
        msg.includes("does not exist") || msg.includes("Unknown table") || msg.includes("relation");
      if (!missingTable) {
        throw dbErr;
      }

      // Fallback para esquemas incompletos (sin deletedAt, etc.)
      const fallbackWhere = msg.includes("deletedAt") ? whereWithoutDeletedAt() : where;
      const fallback = await prisma.album.findMany({
        where: fallbackWhere,
        select: {
          id: true,
          title: true,
          publicSlug: true,
          createdAt: true,
          firstPhotoDate: true,
          isHidden: true,
          isPublic: true,
          expirationExtensionDays: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        } as any,
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      albums = fallback.map((a) => ({
        ...a,
        expirationExtensionDays: (a as any).expirationExtensionDays ?? 0,
        isPublic: (a as any).isPublic ?? true,
        _count: { photos: 0, orders: 0, interests: 0 },
      })) as AlbumSummary[];
      orderMap = new Map();
    }

    const now = Date.now();
    const response = albums.map((album) => {
      const { visibleUntil, availableUntil } = computeDates(album as AlbumSummary);
      const isExpired = now >= visibleUntil.getTime();
      const statusValue = album.isHidden || isExpired ? "INACTIVE" : "ACTIVE";
      const orderData = orderMap.get(album.id) || { revenueCents: 0, ordersCount: 0 };
      return {
        id: album.id,
        title: album.title,
        publicSlug: album.publicSlug,
        createdAt: album.createdAt,
        firstPhotoDate: album.firstPhotoDate,
        isHidden: album.isHidden,
        isPublic: album.isPublic ?? true,
        expirationExtensionDays: album.expirationExtensionDays ?? 0,
        photosCount: album._count.photos,
        interestsCount: album._count.interests,
        ordersCount: orderData.ordersCount,
        revenueCents: orderData.revenueCents,
        visibleUntil,
        availableUntil,
        status: statusValue,
        user: album.user,
      };
    });

    return NextResponse.json({ albums: response });
  } catch (err: any) {
    console.error("GET /api/admin/albums ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo álbumes", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id)) : [];
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "ids debe ser un array con al menos un ID válido" },
        { status: 400 }
      );
    }

    for (const albumId of ids) {
      const album = await prisma.album.findUnique({
        where: { id: albumId },
        select: { id: true },
      });
      if (!album) continue;

      // Soft delete: no se borran pedidos ni contactos/interesados; las descargas quedan inhabilitadas
      await prisma.album.update({
        where: { id: albumId },
        data: { deletedAt: new Date(), isHidden: true },
      });
    }

    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: "DELETE_BULK",
      entityType: "Album",
      description: `Eliminación masiva de álbumes: ${ids.join(", ")}`,
      beforeData: { ids },
      afterData: { deleted: ids.length },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (err: any) {
    console.error("DELETE /api/admin/albums ERROR >>>", err);
    return NextResponse.json(
      { error: "Error eliminando álbumes", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id)) : [];
    const action = body?.action;
    const daysToAdd = Number(body?.daysToAdd ?? 0);

    if (ids.length === 0 || (action !== "activate" && action !== "deactivate")) {
      return NextResponse.json(
        { error: "ids y action son requeridos" },
        { status: 400 }
      );
    }

    if (action === "deactivate") {
      await prisma.album.updateMany({
        where: { id: { in: ids } },
        data: { isHidden: true },
      });
    } else {
      const safeDays = Number.isFinite(daysToAdd) ? daysToAdd : 0;
      for (const albumId of ids) {
        let current: { expirationExtensionDays?: number | null } | null = null;
        try {
          current = await prisma.album.findUnique({
            where: { id: albumId },
            select: { expirationExtensionDays: true } as any,
          });
        } catch (findErr: any) {
          const msg = String(findErr?.message ?? "");
          const missingField =
            msg.includes("expirationExtensionDays") &&
            (msg.includes("Unknown field") ||
              msg.includes("Unknown column") ||
              msg.includes("Unknown argument") ||
              msg.includes("does not exist"));
          if (!missingField) {
            throw findErr;
          }
          current = { expirationExtensionDays: 0 };
        }
        if (!current) continue;
        const nextValue = Math.max(0, (current.expirationExtensionDays ?? 0) + safeDays);
        try {
          await prisma.album.update({
            where: { id: albumId },
            data: { expirationExtensionDays: nextValue, isHidden: false } as any,
          });
        } catch (updateErr: any) {
          const msg = String(updateErr?.message ?? "");
          const missingField =
            msg.includes("expirationExtensionDays") &&
            (msg.includes("Unknown field") ||
              msg.includes("Unknown column") ||
              msg.includes("Unknown argument") ||
              msg.includes("does not exist"));
          if (!missingField) {
            throw updateErr;
          }
          await prisma.album.update({
            where: { id: albumId },
            data: { isHidden: false },
          });
        }
      }
    }

    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: action === "activate" ? "ACTIVATE" : "DEACTIVATE",
      entityType: "Album",
      description: `Actualización masiva de álbumes (${action}): ${ids.join(", ")}`,
      beforeData: { ids },
      afterData: { updated: ids.length, action, daysToAdd },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ ok: true, updated: ids.length });
  } catch (err: any) {
    console.error("PATCH /api/admin/albums ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando álbumes", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
