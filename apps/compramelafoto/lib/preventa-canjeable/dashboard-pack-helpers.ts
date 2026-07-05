import { prisma } from "@/lib/prisma";
import type { AlbumMode } from "@/lib/prisma";

export async function findAlbumOwnedByUser(
  albumId: number,
  userId: number
): Promise<{ id: number; mode: AlbumMode } | null> {
  return prisma.album.findFirst({
    where: { id: albumId, userId },
    select: { id: true, mode: true },
  });
}

/** Template del álbum, de un AlbumProduct del álbum, o plantilla de sistema. */
export async function assertTemplateAccessibleForAlbum(
  templateId: number,
  albumId: number
): Promise<void> {
  const t = await prisma.template.findUnique({
    where: { id: templateId },
    select: { albumId: true, albumProductId: true, isSystemTemplate: true },
  });
  if (!t) {
    throw new Error("Plantilla no encontrada");
  }
  if (t.albumId === albumId) return;
  if (t.isSystemTemplate === true && t.albumId == null) return;
  if (t.albumProductId != null) {
    const ap = await prisma.albumProduct.findFirst({
      where: { id: t.albumProductId, albumId },
      select: { id: true },
    });
    if (ap) return;
  }
  throw new Error("La plantilla no está disponible para este álbum");
}

export async function assertPhotographerProductOwnedByUser(
  productId: number,
  userId: number
): Promise<void> {
  const p = await prisma.photographerProduct.findFirst({
    where: { id: productId, userId },
    select: { id: true },
  });
  if (!p) {
    throw new Error("El producto físico no pertenece a tu cuenta");
  }
}

export function parseOptionalIsoDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Fecha inválida (usar ISO 8601)");
  }
  return d;
}
