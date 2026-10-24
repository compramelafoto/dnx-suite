import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { uploadSchoolLogoFromFormData } from "@/lib/school-logo-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/fotografo/schools/upload-logo
 * FormData: file. Sube a R2 bajo school-logos/{userId}/ y devuelve logoUrl para crear/actualizar escuela.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const formData = await req.formData();
    const result = await uploadSchoolLogoFromFormData(formData, {
      prefix: `school-logos/${user.id}`,
      metadata: { userId: String(user.id) },
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ logoUrl: result.logoUrl });
  } catch (e) {
    console.error("school upload-logo error:", e);
    return NextResponse.json({ error: "Error al subir el logo" }, { status: 500 });
  }
}
