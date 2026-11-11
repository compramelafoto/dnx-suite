// app/api/portal/cursos/material/[attachmentId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import { cargarAccesoVigente } from "@/lib/course-classroom/mis-cursos";
import { getFotofficeR2PublicUrl } from "@/lib/images/r2-client";
import { logCourseEvent } from "@/lib/presential-courses/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * El material de una clase (el PDF que acompaña al video).
 *
 * Sólo lo baja quien tiene el curso vigente. El archivo vive en el bucket público, bajo una
 * carpeta con un nombre al azar: la dirección no se adivina, y esta ruta es la única que la da.
 * Se redirige en vez de pasar el archivo por acá porque un PDF de clase puede superar el tope
 * de respuesta de las funciones.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const adjunto = await prisma.courseLessonAttachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, storageKey: true, lesson: { select: { id: true, courseId: true } } },
  });
  if (!adjunto) return NextResponse.json({ ok: false }, { status: 404 });

  const acceso = await cargarAccesoVigente(user.id, adjunto.lesson.courseId);
  if (!acceso) return NextResponse.json({ ok: false }, { status: 403 });

  logCourseEvent("aula_material_descargado", { accessId: acceso.id, lessonId: adjunto.lesson.id, attachmentId });
  return NextResponse.redirect(getFotofficeR2PublicUrl(adjunto.storageKey), {
    status: 302,
    headers: { "Cache-Control": "private, no-store" },
  });
}
