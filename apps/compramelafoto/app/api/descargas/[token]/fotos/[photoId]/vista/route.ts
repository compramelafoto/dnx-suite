import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { readDigitalDeliveryBuffer } from "@/lib/digital-delivery-r2-key";
import { computeDownloadAvailability } from "@/lib/digital-download/download-link-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREVIEW_MAX_WIDTH = 640;

export async function GET(
  _req: NextRequest,
  ctx:
    | { params: { token: string; photoId: string } }
    | { params: Promise<{ token: string; photoId: string }> }
) {
  try {
    const { token, photoId: photoIdRaw } = await Promise.resolve(ctx.params);
    const photoId = parseInt(photoIdRaw, 10);

    if (!token?.trim() || !Number.isFinite(photoId) || photoId <= 0) {
      return new NextResponse("No encontrado", { status: 404 });
    }

    const tokenRecord = await prisma.orderDownloadToken.findUnique({
      where: { token },
      select: {
        type: true,
        orderId: true,
        expiresAt: true,
      },
    });

    if (!tokenRecord || tokenRecord.type !== "CLIENT_DIGITAL" || !tokenRecord.orderId) {
      return new NextResponse("No encontrado", { status: 404 });
    }

    const { status } = computeDownloadAvailability(tokenRecord.expiresAt);
    if (status === "expired") {
      return new NextResponse("Link vencido", { status: 410 });
    }

    const order = await prisma.order.findUnique({
      where: { id: tokenRecord.orderId },
      select: {
        status: true,
        album: { select: { deletedAt: true } },
        items: {
          where: { productType: "DIGITAL", photoId },
          select: { photoId: true },
        },
      },
    });

    if (
      !order ||
      order.status !== "PAID" ||
      order.album?.deletedAt ||
      order.items.length === 0
    ) {
      return new NextResponse("No autorizado", { status: 403 });
    }

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      select: { id: true, originalKey: true, previewUrl: true },
    });

    if (!photo?.originalKey) {
      return new NextResponse("Foto no disponible", { status: 404 });
    }

    const { buffer } = await readDigitalDeliveryBuffer({
      id: photo.id,
      originalKey: photo.originalKey,
      previewUrl: photo.previewUrl,
    });

    const preview = await sharp(buffer)
      .rotate()
      .resize({ width: PREVIEW_MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    return new NextResponse(preview as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[descargas/preview]", err);
    return new NextResponse("Error generando vista previa", { status: 500 });
  }
}
