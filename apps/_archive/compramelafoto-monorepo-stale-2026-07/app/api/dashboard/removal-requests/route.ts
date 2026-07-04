import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Listar solicitudes de remoción del fotógrafo autenticado
export async function GET(req: Request) {
  try {
    // Obtener parámetros de query
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const query = searchParams.get("query")?.trim() || "";

    // TODO: Implementar autenticación del fotógrafo
    // Por ahora, usar un parámetro temporal photographerId (en producción usar sesión/auth)
    const photographerIdParam = searchParams.get("photographerId");
    if (!photographerIdParam || !Number.isFinite(Number(photographerIdParam))) {
      return NextResponse.json(
        { error: "photographerId es requerido" },
        { status: 400 }
      );
    }

    const photographerId = Number(photographerIdParam);

    // Construir filtros
    const where: any = {
      photographerId,
    };

    if (status && status !== "ALL" && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      where.status = status;
    }

    if (query) {
      where.OR = [
        { requesterName: { contains: query, mode: "insensitive" } },
        { requesterEmail: { contains: query, mode: "insensitive" } },
        { requesterPhone: { contains: query } },
      ];
    }

    // Obtener solicitudes (limitado a 200)
    const requests = await prisma.removalRequest.findMany({
      where,
      include: {
        album: {
          select: {
            id: true,
            title: true,
            publicSlug: true,
          },
        },
        photo: {
          select: {
            id: true,
            previewUrl: true,
            isRemoved: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 200,
    });

    return NextResponse.json(requests, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/dashboard/removal-requests ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo solicitudes", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
