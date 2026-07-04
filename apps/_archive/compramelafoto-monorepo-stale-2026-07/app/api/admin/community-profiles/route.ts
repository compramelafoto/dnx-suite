import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as "PHOTOGRAPHER_SERVICE" | "EVENT_VENDOR" | null;
    if (!type || !["PHOTOGRAPHER_SERVICE", "EVENT_VENDOR"].includes(type)) {
      return NextResponse.json({ error: "type debe ser PHOTOGRAPHER_SERVICE o EVENT_VENDOR" }, { status: 400 });
    }

    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();

    const where: Record<string, unknown> = { type };
    if (status && ["PENDING", "ACTIVE", "DISABLED"].includes(status)) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
        { whatsapp: { contains: search } },
      ];
    }

    const profiles = await prisma.communityProfile.findMany({
      where,
      include: {
        categories: { include: { category: { select: { name: true, slug: true } } } },
        workReferences: { select: { id: true, label: true } },
      },
      orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    });

    return NextResponse.json({ profiles });
  } catch (err) {
    console.error("GET /api/admin/community-profiles ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al listar perfiles", detail: String((err as Error).message) },
      { status: 500 }
    );
  }
}
