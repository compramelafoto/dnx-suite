import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { resolveMarketplaceFeePercent } from "@/lib/pricing/pricing-engine";

/**
 * GET /api/dashboard/photographer
 * Datos del fotógrafo autenticado + % fee marketplace para venta digital de álbum (`ALBUM_ORDER`),
 * vía `resolveMarketplaceFeePercent` → `resolveAlbumOrderDigitalMarketplaceFeePercent`
 * (override cuenta → override lab → commissionDigital_Bps global → fallback legacy).
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.LAB]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol PHOTOGRAPHER o LAB_PHOTOGRAPHER." },
        { status: 401 }
      );
    }

    let photographer: any = null;
    try {
      photographer = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          name: true,
          preferredLabId: true,
          profitMarginPercent: true,
          mpAccessToken: true,
        },
      });
    } catch (err) {
      console.warn("GET /api/dashboard/photographer: fallback sin mpAccessToken", err);
      photographer = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          name: true,
          preferredLabId: true,
          profitMarginPercent: true,
        },
      });
    }

    if (!photographer) {
      return NextResponse.json(
        { error: "Fotógrafo no encontrado" },
        { status: 404 }
      );
    }

    const { mpAccessToken, ...safePhotographer } = photographer || {};
    const platformCommissionPercent = await resolveMarketplaceFeePercent({
      flow: "ALBUM_ORDER",
      photographerId: user.id,
      labId: safePhotographer?.preferredLabId ?? null,
      labType: null,
    });
    return NextResponse.json({
      ...safePhotographer,
      mpConnected: Boolean(mpAccessToken),
      platformCommissionPercent,
    });
  } catch (err: any) {
    console.error("GET /api/dashboard/photographer ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo datos del fotógrafo", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
