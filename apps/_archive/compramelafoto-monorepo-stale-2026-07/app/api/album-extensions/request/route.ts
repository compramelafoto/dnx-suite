import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@prisma/client";

type AlbumExtensionRequester =
  | "CLIENT_PUBLIC"
  | "PHOTOGRAPHER"
  | "LAB_PHOTOGRAPHER"
  | "ADMIN";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const albumId = Number(body?.albumId);
    const daysToAdd = Number.isFinite(Number(body?.daysToAdd)) ? Number(body?.daysToAdd) : 30;

    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "albumId inválido" }, { status: 400 });
    }
    if (!Number.isFinite(daysToAdd) || daysToAdd <= 0) {
      return NextResponse.json({ error: "daysToAdd inválido" }, { status: 400 });
    }

    const authUser = await getAuthUser();
    let requestedByRole: AlbumExtensionRequester = "CLIENT_PUBLIC";
    let requestedByUserId: number | null = null;

    if (authUser) {
      requestedByUserId = authUser.id;
      if (authUser.role === Role.ADMIN) {
        requestedByRole = "ADMIN";
      } else if (authUser.role === Role.LAB_PHOTOGRAPHER) {
        requestedByRole = "LAB_PHOTOGRAPHER";
      } else if (authUser.role === Role.PHOTOGRAPHER || authUser.role === Role.LAB) {
        requestedByRole = "PHOTOGRAPHER";
      }
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: {
        id: true,
        createdAt: true,
        firstPhotoDate: true,
      },
    });

    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const current = (album as any).expirationExtensionDays ?? 0;
    const nextValue = Math.max(0, current + daysToAdd);

    let updated;
    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
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
          } as any,
        });

      const txAny = tx as any;
      if (txAny.albumExtension?.create) {
        await txAny.albumExtension.create({
          data: {
            albumId,
            requestedByRole: requestedByRole as AlbumExtensionRequester,
            requestedByUserId: requestedByUserId ?? undefined,
            daysAdded: daysToAdd,
          },
        });
      }

        return updatedAlbum;
      });
    } catch (txErr: any) {
      const msg = String(txErr?.message ?? txErr);
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
          } as any,
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
          } as any,
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
    } catch (resetErr: any) {
      console.warn("No se pudo resetear intereses del álbum:", resetErr);
    }

    const baseDate = new Date(
      ((updated as any).firstPhotoDate ?? (updated as any).createdAt) as any
    );
    const effectiveExtensionDays =
      typeof (updated as any).expirationExtensionDays === "number"
        ? (updated as any).expirationExtensionDays
        : nextValue;
    const visibleUntil = new Date(
      baseDate.getTime() + (30 + effectiveExtensionDays) * 24 * 60 * 60 * 1000
    );
    const availableUntil = new Date(
      baseDate.getTime() + (45 + effectiveExtensionDays) * 24 * 60 * 60 * 1000
    );

    return NextResponse.json({
      success: true,
      albumId: updated.id,
      expirationExtensionDays: (updated as any).expirationExtensionDays ?? 0,
      visibleUntil,
      availableUntil,
    });
  } catch (err: any) {
    console.error("POST /api/album-extensions/request ERROR >>>", err);
    return NextResponse.json(
      { error: "Error solicitando extensión", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
