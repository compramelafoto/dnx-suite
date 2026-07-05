import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

type AlbumExtensionRequester =
  | "CLIENT_PUBLIC"
  | "PHOTOGRAPHER"
  | "LAB_PHOTOGRAPHER"
  | "ADMIN";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id);
    if (isNaN(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const daysToAdd = Number(body?.daysToAdd);
    if (!Number.isFinite(daysToAdd)) {
      return NextResponse.json({ error: "daysToAdd es requerido" }, { status: 400 });
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
    try {
      updated = await prisma.$transaction(async (tx) => {
        const updatedAlbum = await tx.album.update({
          where: { id: albumId },
          data: { expirationExtensionDays: nextValue } as any,
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
              requestedByRole: "ADMIN" as AlbumExtensionRequester,
              requestedByUserId: user.id,
              daysAdded: daysToAdd,
            },
          });
        }

        return updatedAlbum;
      });
    } catch (txErr: any) {
      const msg = String(txErr?.message ?? "");
      const missingExtensionTable =
        (msg.includes("AlbumExtension") || msg.includes("albumExtension")) &&
        (msg.includes("does not exist") || msg.includes("Unknown table") || msg.includes("Unknown column"));
      const missingExtensionField =
        msg.includes("expirationExtensionDays") &&
        (msg.includes("Unknown column") || msg.includes("Unknown field") || msg.includes("does not exist"));

      if (missingExtensionTable) {
        console.warn("AlbumExtension no existe en DB. Actualizando solo el álbum.");
        updated = await prisma.album.update({
          where: { id: albumId },
          data: { expirationExtensionDays: nextValue } as any,
          select: {
            id: true,
            firstPhotoDate: true,
            createdAt: true,
          } as any,
        });
      } else if (missingExtensionField) {
        return NextResponse.json(
          {
            error: "La base de datos no tiene el campo expirationExtensionDays",
            detail: "Ejecutá: npx prisma db push && npx prisma generate",
          },
          { status: 409 }
        );
      } else {
        throw txErr;
      }
    }

    const baseDate = new Date(
      ((updated as any).firstPhotoDate ?? (updated as any).createdAt) as any
    );
    const visibleUntil = new Date(
      baseDate.getTime() + (30 + ((updated as any).expirationExtensionDays ?? nextValue)) * 24 * 60 * 60 * 1000
    );
    const availableUntil = new Date(
      baseDate.getTime() + (45 + ((updated as any).expirationExtensionDays ?? nextValue)) * 24 * 60 * 60 * 1000
    );

    return NextResponse.json({
      success: true,
      albumId: updated.id,
      expirationExtensionDays: (updated as any).expirationExtensionDays ?? nextValue,
      visibleUntil,
      availableUntil,
    });
  } catch (err: any) {
    console.error("PATCH /api/admin/albums/[id]/extend ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando extensión", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
