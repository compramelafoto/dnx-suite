import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { buscarAccesoPorToken } from "@/lib/course-classroom/lookup";
import { estadoDelAcceso } from "@/lib/course-classroom/access-rules";
import { aplicarReporte } from "@/lib/course-classroom/progress-rules";
import { leerReporte } from "@/lib/course-classroom/report-schema";
import { esChoqueDeCreacion } from "@/lib/course-classroom/choque-de-creacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lo que el reproductor informa cada 15 segundos.
 *
 * Toda la desconfianza está en `aplicarReporte`: acá sólo se comprueba que el enlace sea
 * vigente y que la clase sea de ese curso.
 */
export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const leido = leerReporte(await request.json().catch(() => null));
  if (!leido.ok) return NextResponse.json({ ok: false }, { status: 400 });

  const acceso = await buscarAccesoPorToken(token);
  if (!acceso || estadoDelAcceso(acceso, new Date()) !== "VIGENTE") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const clase = acceso.course.lessons.find(
    (l) => l.id === leido.reporte.lessonId && l.videoStatus === "READY",
  );
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
    // Dos reportes simultáneos sin avance previo: el otro ya creó la fila.
    if (esChoqueDeCreacion(error)) return NextResponse.json({ ok: true, completada: false });
    throw error;
  }
  return NextResponse.json({ ok: true, completada: nuevo.completedAt !== null });
}
