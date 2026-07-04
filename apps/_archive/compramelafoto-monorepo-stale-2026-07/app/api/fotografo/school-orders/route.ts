import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: Listar pedidos escolares (PreCompraOrder con schoolCourseId o álbum vinculado a escuela) */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("schoolId");
    const albumId = searchParams.get("albumId");
    const status = searchParams.get("status");

    const where: any = {
      album: { userId: user.id },
    };

    if (schoolId && Number.isFinite(Number(schoolId))) {
      where.album = { ...where.album, schoolId: Number(schoolId) };
    }
    if (albumId && Number.isFinite(Number(albumId))) {
      where.albumId = Number(albumId);
    }
    if (status && ["CREATED", "PAID_HELD", "CANCELED"].includes(status)) {
      where.status = status;
    }

    const orders = await prisma.preCompraOrder.findMany({
      where,
      include: {
        album: { select: { id: true, title: true, publicSlug: true, schoolId: true, school: { select: { id: true, name: true } } } },
        schoolCourse: { select: { id: true, name: true, division: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(orders);
  } catch (err: any) {
    console.error("GET /api/fotografo/school-orders:", err);
    return NextResponse.json({ error: "Error listando pedidos" }, { status: 500 });
  }
}
