import { NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasWorkLocation } from "@/lib/photographer/work-location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/fotografo/work-location-status
 * Indica si el fotógrafo autenticado tiene ubicación de trabajo configurada.
 */
export async function GET() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);

  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { latitude: true, longitude: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    hasWorkLocation: userHasWorkLocation(profile.latitude, profile.longitude),
  });
}
