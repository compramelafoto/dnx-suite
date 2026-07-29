import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { UPSELL_CAPABILITIES, type Capability } from "@/lib/upsells/capabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const [settings, albumPricing] = await Promise.all([
      prisma.albumSalesSettings.findUnique({
        where: { albumId },
      }),
      prisma.album.findUnique({
        where: { id: albumId },
        select: {
          enableFaceBulkPurchase: true,
          faceBulkPriceCents: true,
        },
      }),
    ]);

    const faceDefaults = {
      enableFaceBulkPurchase: albumPricing?.enableFaceBulkPurchase ?? false,
      faceBulkPriceCents: albumPricing?.faceBulkPriceCents ?? null,
    };

    if (!settings) {
      return NextResponse.json({
        inheritFromPhotographer: true,
        allowedCapabilities: [],
        disabledCapabilities: [],
        ...faceDefaults,
      });
    }

    return NextResponse.json({
      inheritFromPhotographer: settings.inheritFromPhotographer,
      allowedCapabilities: settings.allowedCapabilities,
      disabledCapabilities: settings.disabledCapabilities,
      ...faceDefaults,
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
  { params }: { params: Promise<{ id: string }> }
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

    const enableDigitalPhotos =
      body.enableDigitalPhotos !== undefined ? Boolean(body.enableDigitalPhotos) : undefined;
    const enablePrintedPhotos =
      body.enablePrintedPhotos !== undefined ? Boolean(body.enablePrintedPhotos) : undefined;

    const enableFaceBulkPurchase = Boolean(body.enableFaceBulkPurchase);
    let faceBulkPriceCents: number | null = null;
    if (enableFaceBulkPurchase) {
      const raw = body.faceBulkPriceCents;
      const parsed =
        typeof raw === "number" && Number.isFinite(raw)
          ? Math.round(raw)
          : Math.round(parseFloat(String(raw ?? "")));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return NextResponse.json(
          {
            error:
              "Si activás esta opción, el precio total es obligatorio y debe ser mayor a 0 (pesos ARS enteros, misma unidad que el precio digital por foto del álbum).",
          },
          { status: 400 }
        );
      }
      faceBulkPriceCents = parsed;
    }

    const albumUpdateData: {
      enableFaceBulkPurchase: boolean;
      faceBulkPriceCents: number | null;
      enableDigitalPhotos?: boolean;
      enablePrintedPhotos?: boolean;
    } = {
      enableFaceBulkPurchase,
      faceBulkPriceCents: enableFaceBulkPurchase ? faceBulkPriceCents : null,
    };
    if (enableDigitalPhotos !== undefined) {
      albumUpdateData.enableDigitalPhotos = enableDigitalPhotos;
    }
    if (enablePrintedPhotos !== undefined) {
      albumUpdateData.enablePrintedPhotos = enablePrintedPhotos;
    }

    const [settings, albumUpdated] = await prisma.$transaction([
      prisma.albumSalesSettings.upsert({
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
      }),
      prisma.album.update({
        where: { id: albumId },
        data: albumUpdateData,
        select: {
          enableDigitalPhotos: true,
          enablePrintedPhotos: true,
          enableFaceBulkPurchase: true,
          faceBulkPriceCents: true,
        },
      }),
    ]);

    return NextResponse.json({
      ...settings,
      enableDigitalPhotos: albumUpdated.enableDigitalPhotos,
      enablePrintedPhotos: albumUpdated.enablePrintedPhotos,
      enableFaceBulkPurchase: albumUpdated.enableFaceBulkPurchase,
      faceBulkPriceCents: albumUpdated.faceBulkPriceCents,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Error al guardar ventas del álbum." },
      { status: 500 }
    );
  }
}
