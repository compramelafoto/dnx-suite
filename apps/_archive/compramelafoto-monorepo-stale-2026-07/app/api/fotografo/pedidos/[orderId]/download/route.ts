import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { ensureDigitalDelivery } from "@/lib/digital-delivery";
import { getOrderDownloadTokens } from "@/lib/download-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { orderId: string } | Promise<{ orderId: string }> }) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

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
    if (!printOrder || printOrder.photographerId !== user.id) {
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
  if (!digitalOrder || (!isOwner && !isCollaborator)) {
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

  // Devolver URL de descarga para el fotógrafo: usar el token existente del pedido
  // (ensureDigitalDelivery solo asegura token + job; no devuelve URL por diseño para el cliente)
  const tokens = await getOrderDownloadTokens(id);
  const clientToken = tokens.find((t) => t.type === "CLIENT_DIGITAL");
  const baseUrl = process.env.APP_URL || (typeof req.url === "string" ? req.url.split("/api")[0] : "") || "";

  if (clientToken?.token) {
    return NextResponse.json({
      downloadUrl: `${baseUrl}/api/downloads/${clientToken.token}`,
      expiresAt: download.expiresAt,
      emailWhenReady: download.emailWhenReady,
    });
  }

  // Sin token aún (raro): devolver lo que aseguró ensureDigitalDelivery
  return NextResponse.json(download);
}
