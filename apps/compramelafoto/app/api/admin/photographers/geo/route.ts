import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isCoordPairValid, isInsideArgentinaBounds } from "@/lib/geo/argentina-bounds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/photographers/geo
 * Fotógrafos con ubicación para mapa admin (solo ADMIN).
 */
export async function GET() {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      const status = error === "No autorizado" ? 403 : 401;
      return NextResponse.json({ error: error || "No autenticado" }, { status });
    }

    const users = await prisma.user.findMany({
      where: {
        role: { in: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER] },
        isBlocked: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyName: true,
        city: true,
        province: true,
        country: true,
        address: true,
        latitude: true,
        longitude: true,
        publicPageHandler: true,
        phone: true,
        whatsapp: true,
        instagram: true,
        createdAt: true,
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    });

    const onMap: Array<{
      id: number;
      name: string | null;
      email: string;
      role: string;
      companyName: string | null;
      city: string | null;
      province: string | null;
      address: string | null;
      latitude: number;
      longitude: number;
      publicPageHandler: string | null;
      whatsapp: string | null;
      instagram: string | null;
      inArgentina: boolean;
    }> = [];

    let withCoords = 0;
    let outsideArgentina = 0;
    let withoutCoords = 0;

    for (const u of users) {
      const lat = u.latitude;
      const lng = u.longitude;
      if (lat == null || lng == null || !isCoordPairValid(lat, lng)) {
        withoutCoords += 1;
        continue;
      }
      withCoords += 1;
      const inArgentina = isInsideArgentinaBounds(lat, lng);
      if (!inArgentina) outsideArgentina += 1;
      onMap.push({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        companyName: u.companyName,
        city: u.city,
        province: u.province,
        address: u.address,
        latitude: lat,
        longitude: lng,
        publicPageHandler: u.publicPageHandler,
        whatsapp: u.whatsapp,
        instagram: u.instagram,
        inArgentina,
      });
    }

    return NextResponse.json({
      photographers: onMap,
      stats: {
        totalRegistered: users.length,
        withCoordinates: withCoords,
        withoutCoordinates: withoutCoords,
        onMapArgentina: onMap.filter((p) => p.inArgentina).length,
        outsideArgentinaBounds: outsideArgentina,
      },
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("GET /api/admin/photographers/geo:", err);
    return NextResponse.json({ error: "Error obteniendo ubicaciones de fotógrafos" }, { status: 500 });
  }
}
