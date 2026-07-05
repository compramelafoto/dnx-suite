import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ schoolId: string }>;
};

function parsePositiveInt(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      const status = error === "No autorizado" ? 403 : 401;
      return NextResponse.json(
        { error: error || "No autenticado. Se requiere rol ADMIN." },
        { status }
      );
    }

    const { schoolId: schoolIdRaw } = await params;
    const schoolId = parsePositiveInt(schoolIdRaw);
    if (!schoolId) {
      return NextResponse.json({ error: "schoolId inválido" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as { ownerId?: unknown };
    const ownerIdRaw = body?.ownerId;
    const ownerId = parsePositiveInt(String(ownerIdRaw ?? ""));
    if (!ownerId) {
      return NextResponse.json({ error: "ownerId inválido" }, { status: 400 });
    }

    const [school, ownerUser] = await Promise.all([
      prisma.school.findUnique({
        where: { id: schoolId },
        select: { id: true, ownerId: true },
      }),
      prisma.user.findUnique({
        where: { id: ownerId },
        select: { id: true, name: true, email: true, role: true },
      }),
    ]);

    if (!school) {
      return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
    }

    if (!ownerUser) {
      return NextResponse.json({ error: "Usuario responsable no encontrado" }, { status: 404 });
    }

    if (ownerUser.role !== Role.PHOTOGRAPHER && ownerUser.role !== Role.LAB_PHOTOGRAPHER) {
      return NextResponse.json(
        {
          error:
            "El owner seleccionado no es válido como fotógrafo responsable (roles permitidos: PHOTOGRAPHER, LAB_PHOTOGRAPHER).",
        },
        { status: 400 }
      );
    }

    if (school.ownerId === ownerUser.id) {
      return NextResponse.json({
        ok: true,
        school: {
          id: school.id,
          ownerId: school.ownerId,
        },
        previousOwnerId: school.ownerId,
        newOwnerId: ownerUser.id,
        owner: ownerUser,
      });
    }

    const updatedSchool = await prisma.school.update({
      where: { id: school.id },
      data: { ownerId: ownerUser.id },
      select: {
        id: true,
        ownerId: true,
      },
    });

    console.log("[admin_schools] school_owner_updated", {
      adminUserId: user.id,
      schoolId: school.id,
      previousOwnerId: school.ownerId,
      newOwnerId: ownerUser.id,
    });

    return NextResponse.json({
      ok: true,
      school: updatedSchool,
      previousOwnerId: school.ownerId,
      newOwnerId: ownerUser.id,
      owner: ownerUser,
    });
  } catch (err) {
    console.error("PATCH /api/admin/schools/[schoolId]/owner:", err);
    return NextResponse.json(
      { error: "Error actualizando fotógrafo responsable de la escuela" },
      { status: 500 }
    );
  }
}
