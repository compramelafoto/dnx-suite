import { prisma } from "@/lib/prisma";
import type { RemovalRequestPayload } from "@/lib/public/removal-request";

export type ResultadoRemocion =
  | { ok: true; status: 200 | 201; requestId: number; duplicate: boolean; message: string }
  | { ok: false; status: 400 | 404; error: string };

/**
 * Crea una solicitud de remoción PENDING (no elimina fotos ni concede acceso).
 * La usan POST /api/removal-requests y DNX Bot; la validación del body queda en cada llamador.
 */
export async function crearSolicitudDeRemocion(data: RemovalRequestPayload): Promise<ResultadoRemocion> {
  const photo = await prisma.photo.findUnique({
    where: { id: data.photoId },
    select: {
      id: true,
      albumId: true,
      isRemoved: true,
      album: { select: { userId: true } },
    },
  });

  if (!photo) {
    return { ok: false, status: 404, error: "La foto no existe" };
  }

  if (photo.albumId !== data.albumId) {
    return { ok: false, status: 400, error: "La foto no pertenece a este álbum" };
  }

  if (photo.isRemoved) {
    return { ok: false, status: 400, error: "La foto ya no está disponible" };
  }

  const existing = await prisma.removalRequest.findFirst({
    where: {
      albumId: data.albumId,
      photoId: data.photoId,
      requesterEmail: data.requesterEmail,
      status: "PENDING",
    },
    select: { id: true, createdAt: true },
  });

  if (existing) {
    return {
      ok: true,
      status: 200,
      requestId: existing.id,
      duplicate: true,
      message: "Ya tenemos una solicitud pendiente para esta foto.",
    };
  }

  const request = await prisma.removalRequest.create({
    data: {
      albumId: data.albumId,
      photoId: data.photoId,
      photographerId: photo.album.userId,
      requesterName: data.requesterName,
      requesterEmail: data.requesterEmail,
      requesterPhone: data.requesterPhone,
      reason: data.reason,
      declarationOk: true,
      status: "PENDING",
    },
    select: { id: true, createdAt: true },
  });

  return {
    ok: true,
    status: 201,
    requestId: request.id,
    duplicate: false,
    message: "Recibimos tu solicitud. El fotógrafo la revisará.",
  };
}
