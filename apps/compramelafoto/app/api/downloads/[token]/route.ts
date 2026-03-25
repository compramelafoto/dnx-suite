/**
 * GET /api/downloads/[token]
 *
 * Descarga segura de archivos usando token.
 * Para CLIENT_DIGITAL: permite acceso por token válido O por sesión (userId o email verificado + buyerEmail).
 * IMPORTANTE: Los archivos están en Cloudflare R2, no en el filesystem local.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateDownloadToken } from "@/lib/download-tokens";
import { prisma } from "@/lib/prisma";
import { safeFilename } from "@/lib/safe-filename";
import { readFromR2, urlToR2Key, getSignedUrlForFile } from "@/lib/r2-client";
import { createZipJob, getZipExpiresAt } from "@/lib/zip-job-queue";
import { getAuthUser } from "@/lib/auth";
import { normalizeEmail } from "@/lib/order-claims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOG = "[DOWNLOAD]";

/**
 * Convierte una key de foto (originalKey) a la key de R2
 * Maneja tanto rutas antiguas como nuevas keys de R2
 */
function getR2KeyFromPhotoKey(originalKey: string): string {
  if (!originalKey?.trim()) return originalKey;

  // Si es URL absoluta, extraer key de R2
  if (originalKey.startsWith("http://") || originalKey.startsWith("https://")) {
    return urlToR2Key(originalKey);
  }

  // Si ya es una key de R2 con path (uploads/, albums/, etc.), devolverla tal cual
  if (originalKey.startsWith("uploads/") || originalKey.startsWith("albums/")) {
    return originalKey;
  }

  // Ruta local antigua como "/uploads/archivo.jpg" o "/albums/123/archivo.jpg"
  if (originalKey.startsWith("/")) {
    return originalKey.replace(/^\//, "");
  }

  // Nombre de archivo suelto (formato antiguo): "original_xxx.jpg" -> uploads/
  return `uploads/${originalKey}`;
}

export async function GET(
  req: NextRequest,
  ctx: { params: { token: string } } | { params: Promise<{ token: string }> }
) {
  const params = await Promise.resolve(ctx.params);
  const tokenParam = (params?.token ?? "").toString().trim();
  if (!tokenParam) {
    console.warn(LOG, "Token vacío");
    return NextResponse.json(
      { error: "Token no encontrado" },
      { status: 404 }
    );
  }

  // Resolver token en DB (sin consumir aún)
  const downloadTokenRecord = await prisma.orderDownloadToken.findUnique({
    where: { token: tokenParam },
  });

  if (!downloadTokenRecord) {
    console.warn(LOG, "Token no encontrado", { token: tokenParam.slice(0, 8) + "..." });
    return NextResponse.json(
      { error: "Token no encontrado" },
      { status: 404 }
    );
  }

  if (downloadTokenRecord.expiresAt < new Date()) {
    console.warn(LOG, "Link vencido", { orderId: downloadTokenRecord.orderId, expiresAt: downloadTokenRecord.expiresAt });
    return new NextResponse(
      JSON.stringify({ error: "Link vencido" }),
      { status: 410, headers: { "Content-Type": "application/json" } }
    );
  }

  let downloadToken: {
    id: number;
    type: "CLIENT_DIGITAL" | "LAB_PRINT";
    orderId: number | null;
    photoId: number | null;
    albumId: number | null;
    expiresAt: Date;
    downloadCount: number;
    maxDownloads: number | null;
  };

  try {
    if (downloadTokenRecord.type === "CLIENT_DIGITAL" && downloadTokenRecord.orderId) {
      const orderId = downloadTokenRecord.orderId;
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, buyerUserId: true, buyerEmail: true, status: true },
      });

      if (!order) {
        console.warn(LOG, "Pedido no encontrado", { orderId });
        return NextResponse.json(
          { error: "Pedido no encontrado" },
          { status: 404 }
        );
      }

      const user = await getAuthUser();
      const allowedBySession =
        user &&
        (order.buyerUserId === user.id ||
          (order.buyerUserId == null &&
            !!user.emailVerifiedAt &&
            user.email &&
            normalizeEmail(user.email) === normalizeEmail(order.buyerEmail)));

      if (allowedBySession && user) {
        if (order.buyerUserId == null && normalizeEmail(user.email) === normalizeEmail(order.buyerEmail)) {
          await prisma.order.update({
            where: { id: orderId },
            data: { buyerUserId: user.id, claimedAt: new Date() },
          });
          console.log(LOG, "Pedido reclamado por sesión", { orderId, userId: user.id });
        }
        downloadToken = {
          id: downloadTokenRecord.id,
          type: downloadTokenRecord.type,
          orderId: downloadTokenRecord.orderId,
          photoId: downloadTokenRecord.photoId,
          albumId: downloadTokenRecord.albumId,
          expiresAt: downloadTokenRecord.expiresAt,
          downloadCount: downloadTokenRecord.downloadCount,
          maxDownloads: downloadTokenRecord.maxDownloads,
        };
        console.log(LOG, "Acceso por sesión", { orderId, userId: user.id });
      } else {
        const validation = await validateDownloadToken(tokenParam);
        if (!validation.valid || !validation.token) {
          console.warn(LOG, "Token inválido o límite alcanzado", { orderId, error: validation.error });
          return NextResponse.json(
            { error: validation.error || "Token no válido" },
            { status: 403 }
          );
        }
        downloadToken = validation.token;
      }
    } else if (downloadTokenRecord.type === "LAB_PRINT") {
      const validation = await validateDownloadToken(tokenParam);
      if (!validation.valid || !validation.token) {
        return NextResponse.json(
          { error: validation.error || "Token no válido" },
          { status: 403 }
        );
      }
      downloadToken = validation.token;
    } else {
      const validation = await validateDownloadToken(tokenParam);
      if (!validation.valid || !validation.token) {
        return NextResponse.json(
          { error: validation.error || "Token no válido" },
          { status: 403 }
        );
      }
      downloadToken = validation.token;
    }
  } catch (err: unknown) {
    console.error(LOG, "Error resolviendo acceso", err);
    return NextResponse.json(
      { error: "Error al procesar descarga", detail: String((err as Error)?.message) },
      { status: 500 }
    );
  }

  try {
    if (downloadToken.type === "CLIENT_DIGITAL") {
      // Descarga de foto digital para cliente
      if (!downloadToken.orderId || !downloadToken.albumId) {
        return NextResponse.json(
          { error: "Token inválido: faltan datos del pedido" },
          { status: 400 }
        );
      }

      // Obtener pedido y fotos (y si el álbum fue eliminado, bloquear descarga)
      const order = await prisma.order.findUnique({
        where: { id: downloadToken.orderId },
        include: {
          album: { select: { deletedAt: true } },
          items: {
            include: {
              photo: true,
            },
          },
        },
      });

      if (!order) {
        return NextResponse.json(
          { error: "Pedido no encontrado" },
          { status: 404 }
        );
      }
      if (order.album?.deletedAt) {
        return NextResponse.json(
          { error: "Este álbum ya no está disponible. Las descargas han sido deshabilitadas." },
          { status: 410 }
        );
      }

      // Registrar que el cliente abrió el link / descargó (para icono en panel fotógrafo y admin)
      if (order.downloadLinkViewedAt == null) {
        await prisma.order.update({
          where: { id: order.id },
          data: { downloadLinkViewedAt: new Date() },
        });
      }

      // Si es descarga individual de una foto
      if (downloadToken.photoId) {
        const item = order.items.find(
          (i) => i.photoId === downloadToken.photoId
        );
        if (!item) {
          return NextResponse.json(
            { error: "Foto no encontrada en el pedido" },
            { status: 404 }
          );
        }

        // Leer desde R2
        try {
          const r2Key = getR2KeyFromPhotoKey(item.photo.originalKey);
          const fileBuffer = await readFromR2(r2Key);
          
          return new NextResponse(fileBuffer as any, {
            headers: {
              "Content-Type": "image/jpeg",
              "Content-Disposition": `attachment; filename="${safeFilename(item.photo.originalKey.split("/").pop() || "foto", "foto")}"`,
            },
          });
        } catch (error: any) {
          console.error(LOG, "R2 read failed", {
            originalKey: item.photo.originalKey,
            r2Key: getR2KeyFromPhotoKey(item.photo.originalKey),
            errorMessage: error?.message,
          });
          return NextResponse.json(
            { error: "Archivo no encontrado en R2" },
            { status: 404 }
          );
        }
      } else {
        // Descarga completa del pedido (ZIP)
        const photos = order.items.map((item) => item.photo);

        if (photos.length === 0) {
          return NextResponse.json(
            { error: "No hay fotos para descargar" },
            { status: 404 }
          );
        }

        // Optimización: si es una sola foto, devolverla directo
        if (photos.length === 1) {
          const photo = photos[0];
          try {
            const r2Key = getR2KeyFromPhotoKey(photo.originalKey);
            const fileBuffer = await readFromR2(r2Key);
            const rawName = photo.originalKey.split("/").pop() || "foto";
            const filename = safeFilename(rawName, "foto");
            return new NextResponse(fileBuffer as any, {
              headers: {
                "Content-Type": "image/jpeg",
                "Content-Disposition": `attachment; filename="${filename}"`,
              },
            });
          } catch (error: any) {
            console.error(LOG, "R2 read failed", {
              originalKey: photo.originalKey,
              r2Key: getR2KeyFromPhotoKey(photo.originalKey),
              errorMessage: error?.message,
            });
            return NextResponse.json(
              { error: "Archivo no encontrado en R2" },
              { status: 404 }
            );
          }
        }

        const downloadExpiresAt = getZipExpiresAt();
        const photoIds = photos
          .map((photo) => Number(photo.id))
          .filter((id) => Number.isFinite(id));

        const baseUrl = process.env.APP_URL || `${req.url.split("/api")[0]}`;

        const existingJob = await prisma.zipGenerationJob.findFirst({
          where: {
            orderId: order.id,
            type: "ORDER_DOWNLOAD",
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
        });

        if (existingJob?.status === "COMPLETED") {
          const r2Key = existingJob.r2Key;
          if (r2Key) {
            try {
              const freshUrl = await getSignedUrlForFile(r2Key, 24 * 60 * 60);
              return NextResponse.redirect(freshUrl);
            } catch (e) {
              console.warn(LOG, "No se pudo generar URL firmada para ZIP, usando zipUrl guardada", e);
            }
          }
          if (existingJob.zipUrl) {
            return NextResponse.redirect(existingJob.zipUrl);
          }
        }

        const job =
          existingJob && ["PENDING", "PROCESSING"].includes(existingJob.status)
            ? existingJob
            : await createZipJob({
                type: "ORDER_DOWNLOAD",
                orderId: order.id,
                albumId: order.albumId,
                photoIds,
                expiresAt: downloadExpiresAt,
              });

        const statusUrl = `${baseUrl}/api/zip-jobs/${job.id}/status`;
        const processUrl = `${baseUrl}/api/zip-jobs/${job.id}/process`;

        // Disparar procesamiento inmediato (evita esperar hasta 5 min del cron)
        if (job.status === "PENDING" && process.env.ZIP_JOB_PROCESS_SECRET) {
          fetch(processUrl, {
            method: "POST",
            headers: { "x-zip-secret": process.env.ZIP_JOB_PROCESS_SECRET },
          }).catch((e) => console.warn(LOG, "Trigger inmediato ZIP falló:", e?.message));
        }

        return NextResponse.json(
          {
            message:
              "Estamos generando tu ZIP. Te avisaremos por email cuando esté listo y podés seguir el progreso desde el statusUrl.",
            jobId: job.id,
            statusUrl,
            processUrl,
            expiresAt: downloadExpiresAt,
          },
          { status: 202 }
        );
      }
    } else if (downloadToken.type === "LAB_PRINT") {
      // Descarga para laboratorio (archivos de impresión)
      if (!downloadToken.orderId) {
        return NextResponse.json(
          { error: "Token inválido: falta ID del pedido" },
          { status: 400 }
        );
      }

      // Obtener PrintOrder y items
      const printOrder = await prisma.printOrder.findUnique({
        where: { id: downloadToken.orderId },
        include: {
          items: true,
        },
      });

      if (!printOrder) {
        return NextResponse.json(
          { error: "Pedido no encontrado" },
          { status: 404 }
        );
      }

      // Si es descarga individual
      if (downloadToken.photoId) {
        // Buscar item por fileKey (no hay photoId en PrintOrderItem)
        const item = printOrder.items.find(
          (item) => item.fileKey.includes(downloadToken.photoId!.toString())
        );
        if (!item) {
          return NextResponse.json(
            { error: "Archivo no encontrado en el pedido" },
            { status: 404 }
          );
        }

        try {
          const r2Key = getR2KeyFromPhotoKey(item.fileKey);
          const fileBuffer = await readFromR2(r2Key);
          
          return new NextResponse(fileBuffer as any, {
            headers: {
              "Content-Type": "image/jpeg",
              "Content-Disposition": `attachment; filename="${safeFilename(item.originalName || item.fileKey.split("/").pop() || "archivo", "archivo")}"`,
            },
          });
        } catch (error: any) {
          console.error(LOG, "R2 read failed", {
            originalKey: item.fileKey,
            r2Key: getR2KeyFromPhotoKey(item.fileKey),
            errorMessage: error?.message,
          });
          return NextResponse.json(
            { error: "Archivo no encontrado en R2" },
            { status: 404 }
          );
        }
      } else {
        // Descarga completa (ZIP) - usar la lógica existente del export
        return NextResponse.redirect(
          `/api/print-orders/${printOrder.id}/export`
        );
      }
    }

    return NextResponse.json(
      { error: "Tipo de descarga no soportado" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error(LOG, "Error en descarga:", error);
    return NextResponse.json(
      { error: "Error al procesar descarga", detail: error.message },
      { status: 500 }
    );
  }
}
