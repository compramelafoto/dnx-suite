/**
 * DELETE /api/dashboard/albums/[id]/photos/[photoId]
 * Elimina una foto del álbum
 *
 * PATCH /api/dashboard/albums/[id]/photos/[photoId]
 * Actualiza opciones de venta: sellDigital, sellPrint
 *
 * IMPORTANTE: Los archivos ahora están en Cloudflare R2, no en el filesystem local.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteFromR2, urlToR2Key } from "@/lib/r2-client";

/**
 * PATCH /api/dashboard/albums/[id]/photos/[photoId]
 * Actualiza sellDigital y/o sellPrint de la foto
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; photoId: string } | Promise<{ id: string; photoId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== Role.PHOTOGRAPHER && user.role !== Role.LAB_PHOTOGRAPHER)) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere rol PHOTOGRAPHER o LAB_PHOTOGRAPHER." },
        { status: 401 }
      );
    }

    const { id, photoId: photoIdParam } = await Promise.resolve(params);
    const albumId = parseInt(id);
    const photoId = parseInt(photoIdParam);
    if (isNaN(albumId) || isNaN(photoId)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { userId: true },
    });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }
    if (album.userId !== user.id) {
      return NextResponse.json({ error: "No autorizado para editar este álbum" }, { status: 403 });
    }

    const photo = await prisma.photo.findFirst({
      where: { id: photoId, albumId },
      select: { id: true },
    });
    if (!photo) {
      return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const sellDigital = body.sellDigital;
    const sellPrint = body.sellPrint;
    const data: { sellDigital?: boolean; sellPrint?: boolean } = {};
    if (typeof sellDigital === "boolean") data.sellDigital = sellDigital;
    if (typeof sellPrint === "boolean") data.sellPrint = sellPrint;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Enviá sellDigital y/o sellPrint (boolean)" }, { status: 400 });
    }

    const current = await prisma.photo.findUnique({
      where: { id: photoId },
      select: { sellDigital: true, sellPrint: true },
    });
    const finalDigital = typeof data.sellDigital === "boolean" ? data.sellDigital : (current?.sellDigital ?? true);
    const finalPrint = typeof data.sellPrint === "boolean" ? data.sellPrint : (current?.sellPrint ?? true);
    if (!finalDigital && !finalPrint) {
      return NextResponse.json(
        { error: "Al menos una opción (Digital o Impresa) debe estar habilitada para cada foto. Si no deseás vender esta fotografía en ningún formato, por favor eliminála del álbum." },
        { status: 400 }
      );
    }

    const updated = await prisma.photo.update({
      where: { id: photoId },
      data,
      select: { id: true, sellDigital: true, sellPrint: true },
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    const msg = String(error?.message ?? error);
    console.error("PATCH photo options error:", error);
    if (msg.includes("sellDigital") || msg.includes("sellPrint") || msg.includes("Unknown argument")) {
      return NextResponse.json(
        {
          error:
            "La base de datos o el cliente Prisma no están actualizados. Ejecutá: npx prisma generate && npx prisma migrate deploy. Luego reiniciá el servidor (npm run dev).",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: error?.message || "Error actualizando opciones de la foto" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dashboard/albums/[id]/photos/[photoId]
 * Elimina una foto del álbum
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; photoId: string } | Promise<{ id: string; photoId: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user || (user.role !== Role.PHOTOGRAPHER && user.role !== Role.LAB_PHOTOGRAPHER)) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere rol PHOTOGRAPHER o LAB_PHOTOGRAPHER." },
        { status: 401 }
      );
    }

    const { id, photoId: photoIdParam } = await Promise.resolve(params);
    const albumId = parseInt(id);
    const photoId = parseInt(photoIdParam);

    if (isNaN(albumId) || isNaN(photoId)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { userId: true, coverPhotoId: true },
    });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const photo = await prisma.photo.findFirst({
      where: { id: photoId, albumId },
    });
    if (!photo) {
      return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
    }

    // Solo se puede eliminar la propia foto. Legacy (userId null) se asume del dueño del álbum.
    const isOwner = album.userId === user.id;
    const isMyPhoto = photo.userId === user.id || (photo.userId == null && isOwner);
    if (!isMyPhoto) {
      return NextResponse.json(
        { error: "No podés eliminar fotos de otro fotógrafo" },
        { status: 403 }
      );
    }

    // Si esta foto es la portada, limpiar la referencia
    if (album.coverPhotoId === photoId) {
      await prisma.album.update({
        where: { id: albumId },
        data: { coverPhotoId: null },
      });
    }

    // Eliminar primero las solicitudes de remoción asociadas (si existen)
    // Esto evita el error de foreign key constraint
    try {
      const prismaAny = prisma as any;
      // Intentar eliminar las solicitudes de remoción
      if (prismaAny.removalRequest && typeof prismaAny.removalRequest.deleteMany === 'function') {
        const deleted = await prismaAny.removalRequest.deleteMany({
          where: { photoId },
        });
        console.log(`Eliminadas ${deleted.count} solicitudes de remoción para la foto ${photoId}`);
      } else {
        // Si el modelo no está disponible, intentar con el nombre en camelCase
        if (prismaAny.removalRequest) {
          await prismaAny.removalRequest.deleteMany({
            where: { photoId },
          });
        }
      }
    } catch (removalErr: any) {
      // Si el modelo no existe o hay otro error, loguear pero continuar
      const errorMsg = String(removalErr?.message ?? "");
      if (!errorMsg.includes("Unknown model") && !errorMsg.includes("Cannot read properties")) {
        console.warn("No se pudieron eliminar las solicitudes de remoción asociadas:", errorMsg);
      }
      // Continuar con la eliminación de la foto de todas formas
    }

    const getPreviewKeyFromOriginalKey = (originalKey: string) => {
      const normalized = urlToR2Key(originalKey);
      if (normalized.includes("original_")) {
        return normalized.replace("original_", "preview_");
      }
      return normalized;
    };

    // Eliminar archivos de R2
    try {
      // Eliminar preview (misma key con preview_)
      const previewKey = getPreviewKeyFromOriginalKey(photo.originalKey);
      await deleteFromR2(previewKey).catch(() => {});
    } catch (err) {
      console.warn("No se pudo eliminar preview de R2:", err);
    }

    try {
      // Eliminar original (sin marca de agua)
      const originalKey = urlToR2Key(photo.originalKey);
      await deleteFromR2(originalKey).catch(() => {}); // Ignorar si no existe
    } catch (err) {
      console.warn("No se pudo eliminar original de R2:", err);
    }

    // Eliminar registro de la base de datos
    try {
      await prisma.photo.delete({
        where: { id: photoId },
      });
    } catch (deleteErr: any) {
      // Si falla por foreign key constraint, intentar eliminar las solicitudes primero
      const errorMsg = String(deleteErr?.message ?? "");
      if (errorMsg.includes("RemovalRequest_photoId_fkey") || 
          errorMsg.includes("Foreign key constraint") ||
          errorMsg.includes("removalRequest")) {
        console.log(`Intento de eliminación falló por foreign key, eliminando solicitudes de remoción para foto ${photoId}`);
        try {
          const prismaAny = prisma as any;
          // Intentar eliminar las solicitudes
          if (prismaAny.removalRequest && typeof prismaAny.removalRequest.deleteMany === 'function') {
            const deleted = await prismaAny.removalRequest.deleteMany({
              where: { photoId },
            });
            console.log(`Eliminadas ${deleted.count} solicitudes de remoción, reintentando eliminar foto`);
            
            // Intentar eliminar la foto nuevamente
            await prisma.photo.delete({
              where: { id: photoId },
            });
            console.log(`Foto ${photoId} eliminada exitosamente después de eliminar solicitudes`);
          } else {
            // Si el modelo no está disponible, usar SQL directo como último recurso
            console.warn("Modelo RemovalRequest no disponible, intentando con query raw");
            await prisma.$executeRaw`DELETE FROM "RemovalRequest" WHERE "photoId" = ${photoId}`;
            
            // Intentar eliminar la foto nuevamente
            await prisma.photo.delete({
              where: { id: photoId },
            });
          }
        } catch (retryErr: any) {
          const retryErrorMsg = String(retryErr?.message ?? "");
          console.error("Error al intentar eliminar solicitudes y foto:", retryErrorMsg);
          throw new Error(`No se pudo eliminar la foto porque tiene solicitudes de remoción asociadas. Error: ${retryErrorMsg || errorMsg}`);
        }
      } else {
        throw deleteErr;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error eliminando foto:", error);
    return NextResponse.json(
      { error: error?.message || "Error eliminando foto" },
      { status: 500 }
    );
  }
}
