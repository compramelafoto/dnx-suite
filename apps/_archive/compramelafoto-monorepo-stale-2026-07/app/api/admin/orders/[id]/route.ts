import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { logAdminAction, getRequestMetadata } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapOrderStatusToPaymentStatus(status: string): string {
  if (status === "PAID") return "PAID";
  if (status === "REFUNDED") return "REFUNDED";
  if (status === "CANCELED") return "FAILED";
  return "PENDING";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const orderId = parseInt(id, 10);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        album: {
          select: {
            id: true,
            title: true,
            publicSlug: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        items: {
          select: {
            id: true,
            photoId: true,
            productType: true,
            size: true,
            quantity: true,
            priceCents: true,
            subtotalCents: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const photoIds = order.items.map((item) => item.photoId).filter((id) => Number.isFinite(id));
    const photos = photoIds.length
      ? await prisma.photo.findMany({
          where: { id: { in: photoIds } },
          select: { id: true, originalKey: true },
        })
      : [];
    const photoNameById = new Map<number, string>();
    photos.forEach((photo) => {
      const name = photo.originalKey?.split("/").pop() || "";
      if (name) {
        photoNameById.set(photo.id, name);
      }
    });

    const zipJobs = await prisma.zipGenerationJob.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        zipUrl: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    const downloadTokens = await prisma.orderDownloadToken.findMany({
      where: {
        orderId: order.id,
        type: "CLIENT_DIGITAL",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        token: true,
        photoId: true,
        expiresAt: true,
        createdAt: true,
        downloadCount: true,
        maxDownloads: true,
      },
    });

    const referralEarning = await prisma.referralEarning.findFirst({
      where: { saleRef: `ALBUM_ORDER:${orderId}` },
      include: {
        attribution: {
          include: {
            referrerUser: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });
    const referral = referralEarning
      ? {
          isReferred: true,
          referrer: referralEarning.attribution?.referrerUser
            ? {
                id: referralEarning.attribution.referrerUser.id,
                name: referralEarning.attribution.referrerUser.name,
                email: referralEarning.attribution.referrerUser.email,
              }
            : null,
          referralAmountCents: referralEarning.referralAmountCents,
        }
      : { isReferred: false };

    return NextResponse.json({
      id: order.id,
      source: "ALBUM_ORDER",
      createdAt: order.createdAt.toISOString(),
      status: order.status,
      paymentStatus: mapOrderStatusToPaymentStatus(order.status),
      orderType: "DIGITAL",
      total: Math.round(order.totalCents),
      currency: "ARS",
      buyerEmail: order.buyerEmail,
      mpPaymentId: order.mpPaymentId ?? null,
      mpPreferenceId: order.mpPreferenceId ?? null,
      album: order.album
        ? {
            id: order.album.id,
            title: order.album.title,
            publicSlug: order.album.publicSlug,
          }
        : null,
      photographer: order.album?.user
        ? {
            id: order.album.user.id,
            name: order.album.user.name,
            email: order.album.user.email,
          }
        : null,
      items: order.items.map((item) => ({
        id: item.id,
        photoId: item.photoId,
        photoName: photoNameById.get(item.photoId) || null,
        productType: item.productType,
        size: item.size,
        quantity: item.quantity,
        priceCents: item.priceCents,
        subtotalCents: item.subtotalCents,
      })),
      zipJobs: zipJobs.map((job) => ({
        id: job.id,
        status: job.status,
        zipUrl: job.zipUrl,
        expiresAt: job.expiresAt ? job.expiresAt.toISOString() : null,
        createdAt: job.createdAt.toISOString(),
      })),
      downloadTokens: downloadTokens.map((token) => ({
        token: token.token,
        photoId: token.photoId,
        expiresAt: token.expiresAt.toISOString(),
        createdAt: token.createdAt.toISOString(),
        downloadCount: token.downloadCount,
        maxDownloads: token.maxDownloads,
      })),
      referral,
    });
  } catch (err: any) {
    console.error("GET /api/admin/orders/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo pedido", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const orderId = parseInt(id, 10);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    await prisma.order.delete({ where: { id: orderId } });

    const { ipAddress, userAgent } = getRequestMetadata(req);
    await logAdminAction({
      action: "DELETE",
      entityType: "Order",
      entityId: orderId,
      description: `Pedido eliminado: #${orderId}`,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ ok: true, id: orderId });
  } catch (err: any) {
    console.error("DELETE /api/admin/orders/[id] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error eliminando pedido", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
