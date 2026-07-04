import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureCourseOwnership(courseId: number, userId: number) {
  const course = await prisma.schoolCourse.findUnique({
    where: { id: courseId },
    include: { school: { select: { ownerId: true } } },
  });
  return course && course.school.ownerId === userId;
}

/** PATCH: Actualizar curso */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; courseId: string } | Promise<{ id: string; courseId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { courseId } = await Promise.resolve(params);
    const id = parseInt(courseId, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "ID de curso inválido" }, { status: 400 });
    }

    const owned = await ensureCourseOwnership(id, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const data: { name?: string; division?: string | null; sortOrder?: number | null } = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.division !== undefined) data.division = body.division ? String(body.division).trim() : null;
    if (body.sortOrder !== undefined) data.sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : null;

    const course = await prisma.schoolCourse.update({
      where: { id },
      data,
    });

    return NextResponse.json(course);
  } catch (err: any) {
    console.error("PATCH /api/fotografo/schools/[id]/courses/[courseId]:", err);
    return NextResponse.json({ error: "Error actualizando curso" }, { status: 500 });
  }
}

/** DELETE: Eliminar curso */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; courseId: string } | Promise<{ id: string; courseId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { courseId } = await Promise.resolve(params);
    const id = parseInt(courseId, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "ID de curso inválido" }, { status: 400 });
    }

    const owned = await ensureCourseOwnership(id, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
    }

    // Verificar si hay pedidos o subjects usando este curso
    const ordersCount = await prisma.preCompraOrder.count({
      where: { schoolCourseId: id },
    });
    const subjectsCount = await prisma.subject.count({
      where: { schoolCourseId: id },
    });
    if (ordersCount > 0 || subjectsCount > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar: hay pedidos o alumnos vinculados a este curso" },
        { status: 400 }
      );
    }

    await prisma.schoolCourse.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("DELETE /api/fotografo/schools/[id]/courses/[courseId]:", err);
    return NextResponse.json({ error: "Error eliminando curso" }, { status: 500 });
  }
}
