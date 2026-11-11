import { prisma } from "@/lib/prisma";
import { readDigitalDeliveryBuffer } from "@/lib/digital-delivery-r2-key";
import { accesoAOriginales, type AccesoOriginales } from "./originales";
import type { LectorDeOriginal } from "./stream-originales-zip";

export type FotoDelAlbum = { id: number; originalFilename: string | null };

export type AlbumConOriginales =
  | { ok: true; album: { id: number; title: string }; fotos: FotoDelAlbum[] }
  | Extract<AccesoOriginales, { ok: false }>;

/** Álbum + fotos vigentes en orden estable (por id), solo si el usuario es el dueño. */
export async function cargarOriginalesDelAlbum(
  albumId: number,
  userId: number,
): Promise<AlbumConOriginales> {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, title: true, userId: true, deletedAt: true },
  });
  const acceso = accesoAOriginales(album, userId);
  if (!acceso.ok) return acceso;

  const fotos = await prisma.photo.findMany({
    where: { albumId, isRemoved: false, storageDeletedAt: null },
    select: { id: true, originalFilename: true },
    orderBy: { id: "asc" },
  });
  return { ok: true, album: { id: album!.id, title: album!.title }, fotos };
}

/** Lee de R2 el original de una foto del álbum (nunca la vista previa con marca de agua). */
export function lectorDeOriginalesDelAlbum(albumId: number): LectorDeOriginal {
  return async (fotoId) => {
    const foto = await prisma.photo.findFirst({
      where: { id: fotoId, albumId },
      select: { id: true, originalKey: true, previewUrl: true },
    });
    if (!foto) throw new Error(`Foto ${fotoId} no encontrada en el álbum ${albumId}`);
    const { buffer } = await readDigitalDeliveryBuffer(foto);
    return buffer;
  };
}
