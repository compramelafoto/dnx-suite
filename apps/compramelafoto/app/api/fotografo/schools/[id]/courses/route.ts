import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { createSchoolCoursesForOwner } from "@/lib/schools/school-setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST: Crear curso */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const body = await req.json().catch(() => ({}));
    // La ruta del panel no evita repetidos (comportamiento de siempre).
    const result = await createSchoolCoursesForOwner(user.id, schoolId, [body], {
      skipExisting: false,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const course = result.courses[0];

    return NextResponse.json(course);
  } catch (err: any) {
    console.error("POST /api/fotografo/schools/[id]/courses:", err);
    return NextResponse.json({ error: "Error creando curso" }, { status: 500 });
  }
}
