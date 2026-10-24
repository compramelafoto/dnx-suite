import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerAccess } from "@/lib/school-organizer-auth";
import { uploadSchoolLogoFromFormData } from "@/lib/school-logo-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ schoolId: string }>;
};

/**
 * POST /api/school-organizer/schools/[schoolId]/logo
 * FormData: file. Sube el logo a R2 y lo guarda en la escuela.
 * El organizador no puede apuntar el logo a una URL arbitraria: sólo a lo que sube acá.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
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

    const exists = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
    if (!exists) {
      return NextResponse.json({ error: "Escuela no encontrada" }, { status: 404 });
    }

    const formData = await req.formData();
    const result = await uploadSchoolLogoFromFormData(formData, {
      prefix: `school-logos/schools/${schoolId}`,
      metadata: { userId: String(access.user.id), schoolId: String(schoolId) },
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const school = await prisma.school.update({
      where: { id: schoolId },
      data: { logoUrl: result.logoUrl },
      select: { id: true, logoUrl: true },
    });

    return NextResponse.json({ logoUrl: school.logoUrl });
  } catch (err) {
    console.error("POST /api/school-organizer/schools/[schoolId]/logo:", err);
    return NextResponse.json({ error: "Error al subir el logo" }, { status: 500 });
  }
}
