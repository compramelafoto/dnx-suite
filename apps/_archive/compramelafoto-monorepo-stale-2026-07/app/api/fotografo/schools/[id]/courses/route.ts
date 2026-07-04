import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureSchoolOwnership(schoolId: number, userId: number) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { ownerId: true },
  });
  return school && school.ownerId === userId;
}

/** POST: Crear curso */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const schoolId = parseInt(id, 10);
    if (!Number.isFinite(schoolId)) {
      return NextResponse.json({ error: "ID de escuela inválido" }, { status: 400 });
    }

    const owned = await ensureSchoolOwnership(schoolId, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "El nombre del curso es requerido" }, { status: 400 });
    }

    const division = body.division ? String(body.division).trim() : null;
    const sortOrder = body.sortOrder != null ? Number(body.sortOrder) : null;

    const course = await prisma.schoolCourse.create({
      data: {
        schoolId,
        name,
        division: division || null,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : null,
      },
    });

    return NextResponse.json(course);
  } catch (err: any) {
    console.error("POST /api/fotografo/schools/[id]/courses:", err);
    return NextResponse.json({ error: "Error creando curso" }, { status: 500 });
  }
}
