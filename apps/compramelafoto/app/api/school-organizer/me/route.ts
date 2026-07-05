import { NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.SCHOOL_ORGANIZER]);
    if (error || !user) {
      const status = error === "No autorizado" ? 403 : 401;
      return NextResponse.json({ error: error || "No autenticado" }, { status });
    }

    const organizer = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!organizer) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json(organizer);
  } catch (err) {
    console.error("GET /api/school-organizer/me:", err);
    return NextResponse.json(
      { error: "Error obteniendo usuario SCHOOL_ORGANIZER" },
      { status: 500 }
    );
  }
}
