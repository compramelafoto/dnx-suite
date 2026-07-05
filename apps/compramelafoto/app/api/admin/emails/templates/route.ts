import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  try {
    const templates = await prisma.emailTemplate.findMany({
      where: { isActive: true },
      select: {
        id: true,
        key: true,
        name: true,
        subject: true,
        variables: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ templates });
  } catch (err: any) {
    console.error("GET /api/admin/emails/templates ERROR", err);
    return NextResponse.json({ error: "No se pudieron cargar las plantillas" }, { status: 500 });
  }
}
