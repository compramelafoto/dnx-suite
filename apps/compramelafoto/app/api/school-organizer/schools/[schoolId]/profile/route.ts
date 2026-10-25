import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerAccess } from "@/lib/school-organizer-auth";
import { SCHOOL_ORGANIZER_PROFILE_SELECT } from "@/lib/school-organizer-profile-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ schoolId: string }>;
};

/**
 * GET /api/school-organizer/schools/[schoolId]/profile
 * Datos del perfil editables por el organizador (para precargar el formulario).
 * La edición se hace con PATCH /api/school-organizer/schools/[schoolId].
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { schoolId: schoolIdRaw } = await params;
    const schoolId = Number(schoolIdRaw);
    if (!Number.isInteger(schoolId) || schoolId <= 0) {
      return NextResponse.json({ error: "schoolId inválido" }, { status: 400 });
    }

    const access = await requireSchoolOrganizerAccess({ schoolId });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: SCHOOL_ORGANIZER_PROFILE_SELECT,
    });
    if (!school) {
      return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ school });
  } catch (err) {
    console.error("GET /api/school-organizer/schools/[schoolId]/profile:", err);
    return NextResponse.json({ error: "Error obteniendo el perfil de la escuela" }, { status: 500 });
  }
}
