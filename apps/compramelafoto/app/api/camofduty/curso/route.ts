import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { parseShot } from "@/lib/camofduty/course/progress";
import { loadCourseProgress, recordLessonAttempt } from "@/lib/camofduty/course/progress-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/camofduty/curso — progreso del curso del fotógrafo. */
export async function GET() {
  const { error, user } = await requireAuth();
  if (error || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return NextResponse.json({ progress: await loadCourseProgress(user.id) });
}

/** POST /api/camofduty/curso — { lessonId, shot }: corrige la toma de la tarea y guarda la mejor nota. */
export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth();
  if (error || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { lessonId?: unknown; shot?: unknown } | null;
  const lessonId = typeof body?.lessonId === "string" ? body.lessonId : "";
  const shot = parseShot(body?.shot);
  if (!lessonId || !shot) return NextResponse.json({ error: "Toma inválida" }, { status: 400 });
  try {
    const result = await recordLessonAttempt(user.id, lessonId, shot);
    if (!result) return NextResponse.json({ error: "Lección inexistente" }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[camofduty] no se pudo guardar la tarea del curso", { userId: user.id, lessonId, err });
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}
