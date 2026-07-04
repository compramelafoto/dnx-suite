import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/dashboard/photographer
 * Devuelve los datos del fotógrafo autenticado, incluyendo preferredLabId y profitMarginPercent
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
    return NextResponse.json({
      ...safePhotographer,
      mpConnected: Boolean(mpAccessToken),
    });
  } catch (err: any) {
    console.error("GET /api/dashboard/photographer ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo datos del fotógrafo", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
