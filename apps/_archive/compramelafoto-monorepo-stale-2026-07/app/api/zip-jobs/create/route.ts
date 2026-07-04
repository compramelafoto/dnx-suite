import { NextRequest, NextResponse } from "next/server";
import { createZipJob, type ZipJobType, getZipExpiresAt } from "@/lib/zip-job-queue";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolvePhotoIdsForOrder(orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        select: {
          photoId: true,
        },
      },
    },
  });
  if (!order) return [];
  return order.items.map((item) => item.photoId);
}

async function resolvePhotoIdsForAlbum(albumId: number) {
  const photos = await prisma.photo.findMany({
    where: { albumId },
    select: { id: true },
  });
  return photos.map((photo) => photo.id);
}

function parseNumericId(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, albumId, photoIds, meta, requesterUserId } = body;

    const incomingOrderId = parseNumericId(orderId);
    const incomingAlbumId = parseNumericId(albumId);

    if (orderId !== undefined && incomingOrderId === undefined) {
      return NextResponse.json(
        { error: "orderId inválido" },
        { status: 400 }
      );
    }
    if (albumId !== undefined && incomingAlbumId === undefined) {
      return NextResponse.json(
        { error: "albumId inválido" },
        { status: 400 }
      );
    }

    const resolvedPhotoIds: number[] = Array.isArray(photoIds)
      ? photoIds
          .map((value) => Number(value))
          .filter((num) => Number.isFinite(num))
      : [];

    const numericPhotoIds = resolvedPhotoIds
      .map((value) => Number(value))
      .filter((num) => Number.isFinite(num));

    if (!numericPhotoIds.length) {
      if (incomingOrderId !== undefined) {
        resolvedPhotoIds.push(...(await resolvePhotoIdsForOrder(incomingOrderId)));
      } else if (incomingAlbumId !== undefined) {
        resolvedPhotoIds.push(...(await resolvePhotoIdsForAlbum(incomingAlbumId)));
      }
    }

    if (!resolvedPhotoIds.length) {
      return NextResponse.json(
        { error: "Se requieren photoIds válidos o un orderId/albumId con fotos." },
        { status: 400 }
      );
    }

    const type: ZipJobType = incomingOrderId !== undefined
      ? "ORDER_DOWNLOAD"
      : incomingAlbumId !== undefined
        ? "ALBUM_DOWNLOAD"
        : "CUSTOM_PHOTOS";

    const expiresAt = getZipExpiresAt();

    const job = await createZipJob({
      type,
      orderId: incomingOrderId,
      albumId: incomingAlbumId,
      requesterUserId,
      photoIds: numericPhotoIds,
      meta: meta ?? null,
      expiresAt,
    });

    const baseUrl = process.env.APP_URL || `${req.url.split("/api")[0]}`;
    const statusUrl = `${baseUrl}/api/zip-jobs/${job.id}/status`;
    const processUrl = `${baseUrl}/api/zip-jobs/${job.id}/process`;

    // Disparar procesamiento inmediato (evita esperar hasta 5 min del cron)
    if (process.env.ZIP_JOB_PROCESS_SECRET) {
      fetch(processUrl, {
        method: "POST",
        headers: { "x-zip-secret": process.env.ZIP_JOB_PROCESS_SECRET },
      }).catch((e) => console.warn("[zip-jobs/create] Trigger inmediato falló:", e?.message));
    }

    return NextResponse.json({
      jobId: job.id,
      statusUrl,
      processUrl,
      expiresAt: job.expiresAt,
    });
  } catch (error: any) {
    console.error("zip-jobs/create error:", error);
    return NextResponse.json(
      { error: String(error.message || error) },
      { status: 500 }
    );
  }
}
