import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { ensureDigitalDelivery } from "@/lib/digital-delivery";
import { resolveOrderDigitalDownloadLinks } from "@/lib/digital-download/resolve-order-digital-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { orderId: string } | Promise<{ orderId: string }> }) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const isAdmin = user.role === Role.ADMIN;

  const { orderId } = await Promise.resolve(params);
  const id = Number(orderId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const type = body.orderType || "DIGITAL";

  if (type === "PRINT") {
    const printOrder = await prisma.printOrder.findUnique({
      where: { id },
      select: { id: true, photographerId: true },
    });
    if (!printOrder || (!isAdmin && printOrder.photographerId !== user.id)) {
      return NextResponse.json({ error: "No autorizado para ver este pedido" }, { status: 403 });
    }
    const baseUrl = process.env.APP_URL || `${req.url.split("/api")[0]}`;
    return NextResponse.json({
      downloadUrl: `${baseUrl}/api/print-orders/${printOrder.id}/export`,
    });
  }

  const digitalOrder = await prisma.order.findUnique({
    where: { id },
    select: {
      status: true,
      album: { select: { userId: true } },
      items: { select: { photo: { select: { userId: true } } } },
    },
  });
  const isOwner = digitalOrder?.album?.userId === user.id;
  const isCollaborator = digitalOrder?.items?.some(
    (it) => it.photo?.userId === user.id
  );
  if (!digitalOrder || (!isAdmin && !isOwner && !isCollaborator)) {
    return NextResponse.json({ error: "No autorizado para ver este pedido" }, { status: 403 });
  }
  if (digitalOrder.status !== "PAID") {
    return NextResponse.json(
      { error: "La descarga está disponible solo cuando el pago está aprobado." },
      { status: 403 }
    );
  }

  const download = await ensureDigitalDelivery(id);
  if (!download) {
    return NextResponse.json({ error: "No hay fotos digitales para este pedido" }, { status: 404 });
  }

  const baseUrl = process.env.APP_URL || (typeof req.url === "string" ? req.url.split("/api")[0] : "") || "";
  const links = await resolveOrderDigitalDownloadLinks(id, baseUrl, "fotografo_download");
  if (!links) {
    return NextResponse.json({ error: "No se pudieron generar los links de descarga" }, { status: 500 });
  }

  return NextResponse.json({
    downloadUrl: links.legacyDownloadUrl,
    downloadCenterUrl: links.downloadCenterUrl,
    downloadCenterRolloutActive: links.rolloutActive,
    primaryClientUrl: links.primaryClientUrl,
    digitalPhotoCount: links.digitalPhotoCount,
    expiresAt: download.expiresAt,
    emailWhenReady: download.emailWhenReady,
  });
}
