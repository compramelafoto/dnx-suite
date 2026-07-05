import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/prisma";
import type { AuthUser } from "@/lib/auth";

export type AlbumExtensionRequesterRole =
  | "CLIENT_PUBLIC"
  | "PHOTOGRAPHER"
  | "LAB_PHOTOGRAPHER"
  | "ADMIN";

export type RequestAlbumExtensionInput = {
  albumId: number;
  daysToAdd?: number;
  requestedByRole?: AlbumExtensionRequesterRole;
  requestedByUserId?: number | null;
};

export type RequestAlbumExtensionResult = {
  albumId: number;
  expirationExtensionDays: number;
  visibleUntil: Date;
  availableUntil: Date;
};

export function resolveAlbumExtensionRequesterRole(
  user: AuthUser | null
): { requestedByRole: AlbumExtensionRequesterRole; requestedByUserId: number | null } {
  if (!user) {
    return { requestedByRole: "CLIENT_PUBLIC", requestedByUserId: null };
  }
  if (user.role === Role.ADMIN) {
    return { requestedByRole: "ADMIN", requestedByUserId: user.id };
  }
  if (user.role === Role.LAB_PHOTOGRAPHER) {
    return { requestedByRole: "LAB_PHOTOGRAPHER", requestedByUserId: user.id };
  }
  if (user.role === Role.PHOTOGRAPHER || user.role === Role.LAB) {
    return { requestedByRole: "PHOTOGRAPHER", requestedByUserId: user.id };
  }
  return { requestedByRole: "CLIENT_PUBLIC", requestedByUserId: user.id };
}

/**
 * Extiende/reactiva un álbum (misma lógica que POST /api/album-extensions/request).
 */
export async function requestAlbumExtension(
  input: RequestAlbumExtensionInput
): Promise<RequestAlbumExtensionResult> {
  const albumId = input.albumId;
  const daysToAdd = Number.isFinite(Number(input.daysToAdd)) ? Number(input.daysToAdd) : 30;
  const requestedByRole = input.requestedByRole ?? "CLIENT_PUBLIC";
  const requestedByUserId = input.requestedByUserId ?? null;

  if (!Number.isFinite(albumId)) {
    throw new Error("albumId inválido");
  }
  if (!Number.isFinite(daysToAdd) || daysToAdd <= 0) {
    throw new Error("daysToAdd inválido");
  }

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: {
      id: true,
      createdAt: true,
      firstPhotoDate: true,
      expirationExtensionDays: true,
    },
  });

  if (!album) {
    throw new Error("Álbum no encontrado");
  }

  const current = (album as { expirationExtensionDays?: number }).expirationExtensionDays ?? 0;
  const nextValue = Math.max(0, current + daysToAdd);

  const now = new Date();
  const newExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let updated: { id: number; firstPhotoDate: Date | null; createdAt: Date };

  try {
    updated = await prisma.$transaction(async (tx) => {
      const updatedAlbum = await tx.album.update({
        where: { id: albumId },
        data: {
          expirationExtensionDays: nextValue,
          expiresAt: newExpiresAt,
          reactivatedAt: now,
          reactivationCount: { increment: 1 },
          isHidden: false,
        } as any,
        select: {
          id: true,
          firstPhotoDate: true,
          createdAt: true,
          expirationExtensionDays: true,
        },
      });

      const txAny = tx as typeof tx & {
        albumExtension?: { create: (args: unknown) => Promise<unknown> };
      };
      if (txAny.albumExtension?.create) {
        await txAny.albumExtension.create({
          data: {
            albumId,
            requestedByRole,
            requestedByUserId: requestedByUserId ?? undefined,
            daysAdded: daysToAdd,
          },
        });
      }

      return updatedAlbum;
    });
  } catch (txErr: unknown) {
    const msg = String((txErr as Error)?.message ?? txErr);
    const missingExtensionTable =
      (msg.includes("AlbumExtension") || msg.includes("albumExtension")) &&
      (msg.includes("does not exist") || msg.includes("Unknown table") || msg.includes("Unknown column"));
    const missingExtensionField =
      msg.includes("expirationExtensionDays") &&
      (msg.includes("Unknown column") ||
        msg.includes("Unknown field") ||
        msg.includes("Unknown argument") ||
        msg.includes("does not exist"));

    if (missingExtensionTable) {
      console.warn("AlbumExtension no existe en DB. Actualizando solo el álbum.");
      updated = await prisma.album.update({
        where: { id: albumId },
        data: {
          expirationExtensionDays: nextValue,
          expiresAt: newExpiresAt,
          reactivatedAt: now,
          reactivationCount: { increment: 1 },
          isHidden: false,
        } as any,
        select: {
          id: true,
          firstPhotoDate: true,
          createdAt: true,
          expirationExtensionDays: true,
        },
      });
    } else if (missingExtensionField) {
      console.warn("expirationExtensionDays no existe en DB. Reactivando sin extension.");
      updated = await prisma.album.update({
        where: { id: albumId },
        data: { isHidden: false },
        select: {
          id: true,
          firstPhotoDate: true,
          createdAt: true,
          expirationExtensionDays: true,
        },
      });
    } else {
      throw txErr;
    }
  }

  try {
    await prisma.albumInterest.updateMany({
      where: { albumId, hasPurchased: false },
      data: {
        sentE01: false,
        sentE02: false,
        sentE03: false,
        sentE04: false,
        sentE05: false,
        sentE06: false,
        sentE07: false,
        sentE08: false,
        nextEmailAt: now,
        lastNotifiedAt: null,
      },
    });
  } catch (resetErr: unknown) {
    console.warn("No se pudo resetear intereses del álbum:", resetErr);
  }

  const updatedAny = updated as {
    firstPhotoDate?: Date | null;
    createdAt: Date;
    expirationExtensionDays?: number;
  };
  const baseDate = new Date(updatedAny.firstPhotoDate ?? updatedAny.createdAt);
  const effectiveExtensionDays =
    typeof updatedAny.expirationExtensionDays === "number"
      ? updatedAny.expirationExtensionDays
      : nextValue;
  const visibleUntil = new Date(
    baseDate.getTime() + (30 + effectiveExtensionDays) * 24 * 60 * 60 * 1000
  );
  const availableUntil = new Date(
    baseDate.getTime() + (45 + effectiveExtensionDays) * 24 * 60 * 60 * 1000
  );

  return {
    albumId: updated.id,
    expirationExtensionDays: updatedAny.expirationExtensionDays ?? 0,
    visibleUntil,
    availableUntil,
  };
}
