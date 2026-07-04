import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureOwnership(schoolId: number, userId: number) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { ownerId: true },
  });
  if (!school || school.ownerId !== userId) return null;
  return school;
}

/** GET: Detalle de escuela */
export async function GET(
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
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        courses: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { division: "asc" }] },
        albums: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            publicSlug: true,
            type: true,
            preCompraCloseAt: true,
            preCompraProducts: { select: { id: true } },
          },
        },
      },
    });

    if (!school || school.ownerId !== user.id) {
      return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
    }

    return NextResponse.json(school);
  } catch (err: any) {
    console.error("GET /api/fotografo/schools/[id]:", err);
    return NextResponse.json({ error: "Error obteniendo escuela" }, { status: 500 });
  }
}

/** PATCH: Actualizar escuela */
export async function PATCH(
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
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const owned = await ensureOwnership(schoolId, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim() || undefined;
    if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail ? String(body.contactEmail).trim() : null;
    if (body.contactPhone !== undefined) data.contactPhone = body.contactPhone ? String(body.contactPhone).trim() : null;
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
    if (body.address !== undefined) data.address = body.address ? String(body.address).trim() : null;
    if (body.city !== undefined) data.city = body.city ? String(body.city).trim() : null;
    if (body.province !== undefined) data.province = body.province ? String(body.province).trim() : null;
    if (body.country !== undefined) data.country = body.country ? String(body.country).trim() : null;
    if (body.latitude !== undefined) data.latitude = typeof body.latitude === "number" && Number.isFinite(body.latitude) ? body.latitude : null;
    if (body.longitude !== undefined) data.longitude = typeof body.longitude === "number" && Number.isFinite(body.longitude) ? body.longitude : null;

    const school = await prisma.school.update({
      where: { id: schoolId },
      data,
    });

    return NextResponse.json(school);
  } catch (err: any) {
    console.error("PATCH /api/fotografo/schools/[id]:", err);
    return NextResponse.json({ error: "Error actualizando escuela" }, { status: 500 });
  }
}

/** DELETE: Eliminar escuela */
export async function DELETE(
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
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const owned = await ensureOwnership(schoolId, user.id);
    if (!owned) {
      return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
    }

    await prisma.school.delete({ where: { id: schoolId } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("DELETE /api/fotografo/schools/[id]:", err);
    return NextResponse.json({ error: "Error eliminando escuela" }, { status: 500 });
  }
}
