import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      const status = error === "No autorizado" ? 403 : 401;
      return NextResponse.json(
        { error: error || "No autenticado. Se requiere rol ADMIN." },
        { status }
      );
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";

    const users = await prisma.user.findMany({
      where: {
        role: { in: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER] },
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyName: true,
      },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      take: 50,
    });

    return NextResponse.json({
      photographers: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        studioName: user.companyName || null,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/photographers:", err);
    return NextResponse.json(
      { error: "Error obteniendo fotógrafos para asignación" },
      { status: 500 }
    );
  }
}
