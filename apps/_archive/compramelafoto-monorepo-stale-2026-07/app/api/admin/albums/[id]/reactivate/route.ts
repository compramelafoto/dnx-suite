import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

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
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const daysToAdd = Number(body?.daysToAdd ?? 30);
    if (!Number.isFinite(daysToAdd)) {
      return NextResponse.json({ error: "daysToAdd inválido" }, { status: 400 });
    }

    let current: any;
    try {
      current = await prisma.album.findUnique({
        where: { id: albumId },
        select: { expirationExtensionDays: true } as any,
      });
    } catch (selectErr: any) {
      // Si el campo no existe, obtener el álbum sin select
      const msg = String(selectErr?.message ?? "");
      if (msg.includes("expirationExtensionDays") || msg.includes("Unknown field") || msg.includes("Unknown column")) {
        current = await prisma.album.findUnique({
          where: { id: albumId },
        });
      } else {
        throw selectErr;
      }
    }

    if (!current) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const currentExtensionDays = (current as any).expirationExtensionDays ?? 0;
    const nextValue = Math.max(0, currentExtensionDays + daysToAdd);
    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    try {
      await prisma.album.update({
        where: { id: albumId },
        data: {
          expirationExtensionDays: nextValue,
          isHidden: false,
          expiresAt: newExpiresAt,
          reactivatedAt: now,
          reactivationCount: { increment: 1 },
        } as any,
      });
    } catch (updateErr: any) {
      const msg = String(updateErr?.message ?? "");
      if (msg.includes("expirationExtensionDays") || msg.includes("Unknown field") || msg.includes("Unknown argument")) {
        // Si el campo no existe, solo actualizar isHidden
        await prisma.album.update({
          where: { id: albumId },
          data: { isHidden: false },
        });
        return NextResponse.json({ 
          ok: true, 
          albumId, 
          expirationExtensionDays: 0,
          warning: "El campo expirationExtensionDays no está disponible en la base de datos"
        });
      } else {
        throw updateErr;
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

    return NextResponse.json({ ok: true, albumId, expirationExtensionDays: nextValue });
  } catch (err: any) {
    console.error("PATCH /api/admin/albums/[id]/reactivate ERROR >>>", err);
    return NextResponse.json(
      { error: "Error reactivando álbum", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
