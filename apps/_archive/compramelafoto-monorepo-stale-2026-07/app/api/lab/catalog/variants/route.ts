import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.LAB, Role.LAB_PHOTOGRAPHER]);

    if (error || !user) {
      return NextResponse.json({ error: error || "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const labId = searchParams.get("labId");

    if (!labId) {
      return NextResponse.json({ error: "labId es requerido" }, { status: 400 });
    }

    const labIdNum = parseInt(labId);
    if (isNaN(labIdNum)) {
      return NextResponse.json({ error: "labId inválido" }, { status: 400 });
    }

    // Verificar que el lab pertenece al usuario
    const lab = await prisma.lab.findUnique({
      where: { id: labIdNum },
      select: { userId: true },
    });

    if (!lab || lab.userId !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const variants = await prisma.labProductVariant.findMany({
      where: { labId: labIdNum },
      orderBy: [
        { productName: "asc" },
        { category: "asc" },
        { size: "asc" },
      ],
    });

    return NextResponse.json(variants);
  } catch (err: any) {
    console.error("Error obteniendo variantes:", err);
    return NextResponse.json(
      { error: "Error obteniendo variantes", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
