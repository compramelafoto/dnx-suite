import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { getSignedUrlForFile } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/hidden-album-attempts/[id]/selfie
 * Devuelve URL firmada para ver la selfie (solo si selfieStored y solo ADMIN).
 */
export async function GET(
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
    const attempt = await prisma.hiddenAlbumAttempt.findUnique({
      where: { id },
      select: { id: true, selfieStored: true, selfieObjectKey: true, selfieExpiresAt: true },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Intento no encontrado" }, { status: 404 });
    }
    if (!attempt.selfieStored || !attempt.selfieObjectKey) {
      return NextResponse.json({ error: "No hay selfie guardada para este intento" }, { status: 404 });
    }
    if (attempt.selfieExpiresAt && attempt.selfieExpiresAt < new Date()) {
      return NextResponse.json({ error: "La selfie ya fue eliminada (expirada)" }, { status: 410 });
    }

    const expiresIn = 300; // 5 min para ver
    const url = await getSignedUrlForFile(attempt.selfieObjectKey, expiresIn);
    return NextResponse.json({ url, expiresIn });
  } catch (err: any) {
    console.error("Error generando URL selfie:", err);
    return NextResponse.json(
      { error: "Error al generar URL" },
      { status: 500 }
    );
  }
}
