// app/api/portal/cursos/avance/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import { cargarAccesoVigente } from "@/lib/course-classroom/mis-cursos";
import { aplicarReporte } from "@/lib/course-classroom/progress-rules";
import { leerReporte } from "@/lib/course-classroom/report-schema";
import { esChoqueDeCreacion } from "@/lib/course-classroom/choque-de-creacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lo que el reproductor informa cada 15 segundos. La persona sale de la sesión, nunca del
 * cuerpo; la desconfianza sobre los segundos vive en `aplicarReporte`.
 */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const leido = leerReporte(await request.json().catch(() => null));
  if (!leido.ok) return NextResponse.json({ ok: false }, { status: 400 });

  const acceso = await cargarAccesoVigente(user.id, leido.reporte.courseId);
  if (!acceso) return NextResponse.json({ ok: false }, { status: 403 });
  const clase = acceso.course.lessons.find((l) => l.id === leido.reporte.lessonId && l.videoStatus === "READY");
  if (!clase) return NextResponse.json({ ok: false }, { status: 404 });

  const clave = { accessId_lessonId: { accessId: acceso.id, lessonId: clase.id } };
  const previo = await prisma.courseLessonProgress.findUnique({ where: clave });
  const nuevo = aplicarReporte({
    previo,
    reporte: leido.reporte,
    ahora: new Date(),
    duracionSegundos: clase.durationSeconds,
  });
  try {
    await prisma.courseLessonProgress.upsert({
      where: clave,
      create: { accessId: acceso.id, lessonId: clase.id, ...nuevo },
      update: nuevo,
    });
  } catch (error) {
    // Dos reportes simultáneos crearon la misma fila: el otro ya la guardó.
    if (esChoqueDeCreacion(error)) return NextResponse.json({ ok: true, completada: false });
    throw error;
  }
  return NextResponse.json({ ok: true, completada: nuevo.completedAt !== null });
}
