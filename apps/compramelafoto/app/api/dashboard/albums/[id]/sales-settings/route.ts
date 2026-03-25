import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { UPSELL_CAPABILITIES, type Capability } from "@/lib/upsells/capabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado." },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id);
    if (isNaN(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { userId: true },
    });
    if (!album || album.userId !== user.id) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const settings = await prisma.albumSalesSettings.findUnique({
      where: { albumId },
    });

    if (!settings) {
      return NextResponse.json({
        inheritFromPhotographer: true,
        allowedCapabilities: [],
        disabledCapabilities: [],
      });
    }

    return NextResponse.json({
      inheritFromPhotographer: settings.inheritFromPhotographer,
      allowedCapabilities: settings.allowedCapabilities,
      disabledCapabilities: settings.disabledCapabilities,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Error al cargar ventas del álbum." },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado." },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id);
    if (isNaN(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { userId: true },
    });
    if (!album || album.userId !== user.id) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const allowedCapabilities = Array.isArray(body.allowedCapabilities)
      ? body.allowedCapabilities.filter((c: string) =>
          UPSELL_CAPABILITIES.includes(c as Capability)
        )
      : [];
    const disabledCapabilities = Array.isArray(body.disabledCapabilities)
      ? body.disabledCapabilities.filter((c: string) =>
          UPSELL_CAPABILITIES.includes(c as Capability)
        )
      : [];

    const settings = await prisma.albumSalesSettings.upsert({
      where: { albumId },
      create: {
        albumId,
        inheritFromPhotographer: Boolean(body.inheritFromPhotographer),
        allowedCapabilities,
        disabledCapabilities,
      },
      update: {
        inheritFromPhotographer: Boolean(body.inheritFromPhotographer),
        allowedCapabilities,
        disabledCapabilities,
      },
    });

    return NextResponse.json(settings);
  } catch (e) {
    return NextResponse.json(
      { error: "Error al guardar ventas del álbum." },
      { status: 500 }
    );
  }
}
