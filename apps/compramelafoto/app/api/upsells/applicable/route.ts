import { NextRequest, NextResponse } from "next/server";
import { getApplicableUpsells } from "@/lib/upsells/engine";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/upsells/applicable?albumId=123
 * Devuelve los upsells aplicables para un álbum.
 * - Si hay usuario autenticado (fotógrafo): usa su userId para rollout/config.
 * - Si no: se usa el userId del dueño del álbum (contexto carrito público).
 */
export async function GET(req: NextRequest) {
  try {
    const albumIdParam = req.nextUrl.searchParams.get("albumId");
    if (!albumIdParam) {
      return NextResponse.json(
        { error: "Falta albumId" },
        { status: 400 }
      );
    }
    const albumId = parseInt(albumIdParam, 10);
    if (isNaN(albumId)) {
      return NextResponse.json(
        { error: "albumId inválido" },
        { status: 400 }
      );
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { userId: true },
    });
    if (!album) {
      return NextResponse.json(
        { error: "Álbum no encontrado" },
        { status: 404 }
      );
    }

    const user = await getAuthUser();
    const userId = user?.id ?? album.userId;

    const list = await getApplicableUpsells({
      userId,
      albumId,
      allowQa: user?.role === "ADMIN",
    });

    return NextResponse.json({ upsells: list });
  } catch {
    return NextResponse.json({ upsells: [] });
  }
}
