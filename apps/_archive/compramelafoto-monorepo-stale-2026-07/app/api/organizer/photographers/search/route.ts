import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/organizer/photographers/search?q=...
 * Busca fotógrafos de la plataforma por nombre, empresa, teléfono, email, etc.
 * Solo organizadores. Para asignar a eventos privados.
 */
export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth([Role.ORGANIZER]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));

    if (!q || q.length < 2) {
      return NextResponse.json({
        photographers: [],
        message: "Escribí al menos 2 caracteres para buscar.",
      });
    }

    const photographers = await prisma.user.findMany({
      where: {
        role: { in: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER] },
        isBlocked: false,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { companyName: { contains: q, mode: "insensitive" } },
          { companyOwner: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { whatsapp: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        companyOwner: true,
        phone: true,
        city: true,
      },
      take: limit,
      orderBy: [{ name: "asc" }],
    });

    return NextResponse.json({
      photographers: photographers.map((p) => ({
        id: p.id,
        name: p.name ?? undefined,
        email: p.email,
        companyName: p.companyName ?? undefined,
        companyOwner: p.companyOwner ?? undefined,
        phone: p.phone ?? undefined,
        city: p.city ?? undefined,
      })),
    });
  } catch (err: any) {
    console.error("GET /api/organizer/photographers/search ERROR >>>", err);
    return NextResponse.json(
      { error: "Error buscando fotógrafos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
