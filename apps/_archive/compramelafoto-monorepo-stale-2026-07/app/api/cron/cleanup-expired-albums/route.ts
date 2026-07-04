/**
 * GET /api/cron/cleanup-expired-albums
 * 
 * Lógica de eliminación en dos etapas:
 * - Día 30: Marca isHidden = true (oculta álbum de vista pública, pero mantiene archivos)
 * - Día 45: Elimina archivos físicos solo si no hay PrintOrderItem pendientes/activos con esos fileKey
 * 
 * IMPORTANTE: Los archivos ahora están en Cloudflare R2, no en el filesystem local.
 * 
 * Protegido: si CRON_SECRET está definido, el request debe enviar
 *   Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromR2, listObjectsByPrefix, urlToR2Key } from "@/lib/r2-client";
import { deleteFace } from "@/lib/faces/rekognition";
import { assertCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * GET /api/cron/cleanup-expired-albums
 * 
 * Lógica de eliminación en dos etapas:
 * - Día 30: Marca isHidden = true (oculta álbum de vista pública, pero mantiene archivos)
 * - Día 45: Elimina archivos físicos solo si no hay PrintOrderItem pendientes/activos con esos fileKey
 * 
 * Protegido: si CRON_SECRET está definido, el request debe enviar
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  const now = Date.now();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  let hiddenAlbums = 0;
  let deletedAlbums = 0;
  let deletedPhotos = 0;
  let deletedRawUploads = 0;
  let deletedEventCovers = 0;
  let cleanedPrintOrders = 0;
  let deletedPrintFiles = 0;
  let deletedFaceIds = 0;

  // ETAPA 1: Ocultar álbumes de 30 días desde firstPhotoDate (marcar isHidden = true)
  // Solo ocultar álbumes que tienen fotos (firstPhotoDate no es null)
  const albumsToHide = await prisma.album.findMany({
    where: {
      firstPhotoDate: { not: null },
      isHidden: false,
    },
    select: {
      id: true,
      firstPhotoDate: true,
      photos: { select: { id: true } },
    },
  });

  for (const album of albumsToHide) {
    const extensionDays = (album as any).expirationExtensionDays ?? 0;
    const baseDate = album.firstPhotoDate!;
    const hideAt = new Date(baseDate.getTime() + (30 + extensionDays) * 24 * 60 * 60 * 1000);
    if (new Date(now) >= hideAt) {
      await prisma.album.update({
        where: { id: album.id },
        data: { isHidden: true },
      });
      hiddenAlbums++;
    }
  }

  // ETAPA 2: Eliminar archivos físicos de álbumes de 45+ días desde firstPhotoDate
  // Verificar que no haya PrintOrderItem pendientes/activos con esos fileKey
  const albumsToDelete = await prisma.album.findMany({
    where: {
      firstPhotoDate: { not: null },
      isHidden: true,
    },
    select: {
      id: true,
      firstPhotoDate: true,
      photos: {
        select: {
          id: true,
          originalKey: true,
          faceDetections: { select: { rekognitionFaceId: true } },
        },
      },
    },
  });

  for (const album of albumsToDelete) {
    const extensionDays = (album as any).expirationExtensionDays ?? 0;
    const baseDate = album.firstPhotoDate!;
    const deleteAt = new Date(baseDate.getTime() + (45 + extensionDays) * 24 * 60 * 60 * 1000);
    if (new Date(now) < deleteAt) {
      continue;
    }

    // Obtener todos los fileKey de las fotos del álbum
    const fileKeys = album.photos.map((p) => p.originalKey);

    if (fileKeys.length === 0) {
      // Si no hay fotos, eliminar el álbum directamente
      await prisma.album.delete({ where: { id: album.id } });
      deletedAlbums++;
      continue;
    }

    // Verificar si hay PrintOrderItem con estos fileKey en pedidos no cancelados
    const activeOrders = await prisma.printOrderItem.findMany({
      where: {
        fileKey: { in: fileKeys },
        order: {
          status: { notIn: ["CANCELED"] }, // Excluir pedidos cancelados
        },
      },
      select: { id: true, fileKey: true, order: { select: { status: true } } },
    });

    // Si hay pedidos activos con estos archivos, NO eliminar (preservar archivos)
    if (activeOrders.length > 0) {
      continue;
    }

    // Eliminar faceIds de Rekognition antes de borrar fotos (AAIP: biometría ligada a vida del álbum)
    for (const photo of album.photos) {
      for (const fd of (photo as any).faceDetections || []) {
        if (fd.rekognitionFaceId) {
          try {
            await deleteFace(fd.rekognitionFaceId);
            deletedFaceIds++;
          } catch (rekErr) {
            console.warn(`Error eliminando faceId ${fd.rekognitionFaceId} de Rekognition:`, rekErr);
          }
        }
      }
    }

    // No hay pedidos activos, podemos eliminar archivos de R2
    for (const photo of album.photos) {
      try {
        const originalKey = urlToR2Key(photo.originalKey);
        const previewKey = originalKey.includes("original_")
          ? originalKey.replace("original_", "preview_")
          : originalKey;
        
        await deleteFromR2(previewKey).catch(() => {});
        await deleteFromR2(originalKey).catch(() => {});
      } catch (error) {
        console.error(`Error eliminando archivos de R2 para ${photo.originalKey}:`, error);
      }
      deletedPhotos++;
    }

    // Direct upload (albums/{id}/raw): eliminar cuando se eliminan las fotos del álbum
    try {
      const rawPrefix = `albums/${album.id}/raw/`;
      const rawObjects = await listObjectsByPrefix(rawPrefix);
      for (const obj of rawObjects) {
        await deleteFromR2(obj.Key).catch(() => {});
        deletedRawUploads++;
      }
    } catch (err) {
      console.error(`Error eliminando direct-upload del álbum ${album.id}:`, err);
    }

    // Eliminar registros de la base de datos
    await prisma.photo.deleteMany({ where: { albumId: album.id } });
    await prisma.album.delete({ where: { id: album.id } });
    deletedAlbums++;
  }

  // ETAPA 2b: Portadas de eventos - eliminar 45 días después del evento (junto con fotos del álbum)
  const cutoffEvent45 = new Date(now - 45 * MS_PER_DAY);
  const allEventsWithCover = await prisma.event.findMany({
    where: { coverImageKey: { not: null } },
    select: { id: true, coverImageKey: true, endsAt: true, startsAt: true },
  });
  const eventsToClean = allEventsWithCover.filter((ev) => {
    const refDate = ev.endsAt ?? ev.startsAt;
    return refDate && refDate <= cutoffEvent45;
  });
  for (const ev of eventsToClean) {
    if (!ev.coverImageKey) continue;
    try {
      const key = urlToR2Key(ev.coverImageKey) ?? ev.coverImageKey;
      await deleteFromR2(key).catch(() => {});
      deletedEventCovers++;
    } catch (err) {
      console.error(`Error eliminando portada evento ${ev.id}:`, err);
    }
    await prisma.event.update({
      where: { id: ev.id },
      data: { coverImageKey: null },
    });
  }

  // ETAPA 3: Eliminar archivos subidos para impresión (PrintOrder) luego de 15 días
  const cutoffPrint = new Date(now - 15 * 24 * 60 * 60 * 1000);
  const printOrdersToClean = await prisma.printOrder.findMany({
    where: {
      createdAt: { lte: cutoffPrint },
      NOT: { tags: { has: "FILES_DELETED" } },
    },
    select: {
      id: true,
      tags: true,
      items: { select: { fileKey: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  for (const order of printOrdersToClean) {
    try {
      for (const item of order.items) {
        try {
          const key = urlToR2Key(item.fileKey);
          await deleteFromR2(key).catch(() => {});
          deletedPrintFiles++;
        } catch (err) {
          console.error(`Error eliminando archivo de impresión ${item.fileKey}:`, err);
        }
      }

      const tags = Array.isArray(order.tags) ? order.tags : [];
      if (!tags.includes("FILES_DELETED")) {
        await prisma.printOrder.update({
          where: { id: order.id },
          data: { tags: { push: "FILES_DELETED" } },
        });
      }
      cleanedPrintOrders++;
    } catch (err) {
      console.error(`Error limpiando pedido de impresión ${order.id}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    hiddenAlbums,
    deletedAlbums,
    deletedPhotos,
    deletedFaceIds,
    deletedRawUploads,
    deletedEventCovers,
    cleanedPrintOrders,
    deletedPrintFiles,
    cutoff30: "variable_por_album",
    cutoff45: "variable_por_album",
    cutoffPrintDays: 15,
  });
}
