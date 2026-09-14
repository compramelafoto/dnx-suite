import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/video-removal-requests?photographerId=1&status=PENDING
 *
 * Los pedidos de baja de video del fotógrafo. Espeja
 * `/api/dashboard/removal-requests`, el de fotos, para que el panel pueda
 * mostrar las dos listas con la misma forma.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const photographerIdParam = searchParams.get("photographerId");
    if (!photographerIdParam || !Number.isFinite(Number(photographerIdParam))) {
      return NextResponse.json({ error: "photographerId es requerido" }, { status: 400 });
    }
    const photographerId = Number(photographerIdParam);

    const where: Record<string, unknown> = { photographerId };

    const status = searchParams.get("status");
    if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      where.status = status;
    }

    const query = searchParams.get("query")?.trim();
    if (query) {
      where.OR = [
        { requesterName: { contains: query, mode: "insensitive" } },
        { requesterEmail: { contains: query, mode: "insensitive" } },
        { requesterPhone: { contains: query } },
      ];
    }

    const requests = await prisma.videoRemovalRequest.findMany({
      where,
      include: {
        album: { select: { id: true, title: true, publicSlug: true } },
        video: {
          select: {
            id: true,
            title: true,
            isRemoved: true,
            durationSeconds: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(requests, { status: 200 });
  } catch (err: unknown) {
    console.error("[dashboard/video-removal-requests] fatal", err);
    return NextResponse.json(
      { error: "No pudimos cargar los pedidos" },
      { status: 500 }
    );
  }
}
