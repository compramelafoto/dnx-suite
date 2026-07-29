import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClientDownloadToken, getOrderDownloadTokens } from "@/lib/download-tokens";
import { safeFilename } from "@/lib/safe-filename";
import { getAppConfig } from "@/lib/services/settingsService";
import { resolveDownloadLinkDays } from "@/lib/digital-download/download-link-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildFilename(originalKey: string | null, photoId: number): string {
  const raw = originalKey?.split("/").pop()?.trim();
  if (raw) return safeFilename(raw, `foto-${photoId}.jpg`);
  return `foto-${photoId}.jpg`;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(ctx.params);
    const orderId = parseInt(id, 10);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "ID de pedido inválido" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        albumId: true,
        items: {
          where: { productType: "DIGITAL" },
          select: { photoId: true, photo: { select: { originalKey: true } } },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    if (order.status !== "PAID") {
      return NextResponse.json({ error: "El pedido no está aprobado" }, { status: 400 });
    }

    const baseUrl =
      process.env.APP_URL ||
      (typeof req.url === "string" ? req.url.split("/api")[0] : "") ||
      "";

    const existingTokens = await getOrderDownloadTokens(orderId);
    const config = await getAppConfig();
    const downloadDays = resolveDownloadLinkDays(config);
    const files = new Map<number, { photoId: number; filename: string; downloadUrl: string }>();

    for (const item of order.items) {
      if (!Number.isFinite(item.photoId)) continue;
      const photoId = Number(item.photoId);
      if (files.has(photoId)) continue;

      const existingToken = existingTokens.find(
        (t) => t.type === "CLIENT_DIGITAL" && t.photoId === photoId
      );
      const token =
        existingToken?.token ??
        (await createClientDownloadToken({
          orderId,
          albumId: order.albumId,
          photoId,
          expiresAt:
            existingToken?.expiresAt ?? new Date(Date.now() + downloadDays * 24 * 60 * 60 * 1000),
        }));
      const filename = buildFilename(item.photo?.originalKey ?? null, photoId);

      files.set(photoId, {
        photoId,
        filename,
        downloadUrl: `${baseUrl}/api/downloads/${token}`,
      });
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      files: Array.from(files.values()),
      hasPrintItems: order._count.items > order.items.length,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "Error preparando descargas", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
