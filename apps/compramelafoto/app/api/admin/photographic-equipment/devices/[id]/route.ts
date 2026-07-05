import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getPhotographicEquipmentPhotographerDetail } from "@/lib/photographic-equipment/admin-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** @deprecated El id puede ser bodyId (v2) o legacy deviceId. */
export async function GET(_req: NextRequest, context: RouteContext) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
  }

  const { id } = await context.params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await prisma.photographicCameraBody.findUnique({
    where: { id: numericId },
    select: { photographerId: true },
  });

  if (body) {
    const detail = await getPhotographicEquipmentPhotographerDetail(body.photographerId);
    if (!detail) {
      return NextResponse.json({ error: "Fotógrafo no encontrado" }, { status: 404 });
    }
    const bodyCard = detail.bodies.find((b) => b.id === numericId);
    return NextResponse.json({
      deprecated: true,
      message: "Usar GET /api/admin/photographic-equipment/photographers/:photographerId",
      body: bodyCard,
      photographer: detail.photographer,
    });
  }

  const legacy = await prisma.photographerDevice.findUnique({
    where: { id: numericId },
    select: { photographerId: true },
  });
  if (legacy) {
    const detail = await getPhotographicEquipmentPhotographerDetail(legacy.photographerId);
    return NextResponse.json({
      deprecated: true,
      legacyDeviceId: numericId,
      photographer: detail?.photographer ?? null,
      message: "Dispositivo legacy; ver modelo v2 por fotógrafo.",
    });
  }

  return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
}
