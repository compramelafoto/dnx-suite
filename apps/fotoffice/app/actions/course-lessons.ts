"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { z } from "zod";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { createDirectUpload, getVideoStatus } from "@/lib/courses-video/stream";
import { logCourseEvent } from "@/lib/presential-courses/log";
import { calcularNuevoOrden } from "@/lib/presential-courses/lesson-order";

/**
 * Las clases de un curso grabado.
 *
 * El video no se sube por acá: el panel pide una URL al proveedor y el navegador sube contra
 * ella. Estas acciones sólo mantienen el orden, los títulos y el estado de cada clase.
 */

const claseSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(1, "La clase necesita un título.").max(200),
  description: z.string().max(5000).optional().nullable(),
  isPreview: z.boolean().optional(),
});

export type CourseLessonActionState = { error: string | null; ok?: boolean };

async function asegurarCursoDelWorkspace(workspaceId: string, courseId: string) {
  const curso = await prisma.course.findFirst({
    where: { id: courseId, workspaceId },
    select: { id: true, deliveryMode: true },
  });
  if (!curso) throw new Error("Curso no encontrado para este workspace.");
  if (curso.deliveryMode !== "RECORDED") {
    throw new Error("Sólo un curso grabado tiene clases.");
  }
  return curso;
}

async function asegurarClaseDelWorkspace(workspaceId: string, lessonId: string) {
  const clase = await prisma.courseLesson.findFirst({
    where: { id: lessonId, course: { workspaceId } },
    select: { id: true, courseId: true, videoUid: true },
  });
  if (!clase) throw new Error("Clase no encontrada para este workspace.");
  return clase;
}

export async function crearClase(
  _prev: CourseLessonActionState | undefined,
  formData: FormData,
): Promise<CourseLessonActionState> {
  try {
    const { workspace } = await requireCoursesSalesContext();
    const datos = claseSchema.parse({
      courseId: formData.get("courseId")?.toString()?.trim() ?? "",
      title: formData.get("title")?.toString()?.trim() ?? "",
      description: formData.get("description")?.toString()?.trim() || null,
      isPreview: formData.get("isPreview") === "on",
    });
    await asegurarCursoDelWorkspace(workspace.id, datos.courseId);

    // La clase nueva va al final: el fotógrafo carga en el orden en que dicta.
    const ultimas = await prisma.courseLesson.findMany({
      where: { courseId: datos.courseId },
      orderBy: { sortOrder: "desc" },
      take: 1,
      select: { sortOrder: true },
    });
    const sortOrder = (ultimas[0]?.sortOrder ?? -1) + 1;

    const creada = await prisma.courseLesson.create({
      data: {
        courseId: datos.courseId,
        title: datos.title,
        description: datos.description,
        isPreview: datos.isPreview ?? false,
        sortOrder,
      },
      select: { id: true },
    });
    logCourseEvent("clase_creada", {
      workspaceId: workspace.id,
      courseId: datos.courseId,
      lessonId: creada.id,
    });
    revalidatePath(`/dashboard/courses/${datos.courseId}`);
    return { error: null, ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear la clase." };
  }
}

export async function actualizarClase(
  _prev: CourseLessonActionState | undefined,
  formData: FormData,
): Promise<CourseLessonActionState> {
  try {
    const { workspace } = await requireCoursesSalesContext();
    const lessonId = formData.get("lessonId")?.toString()?.trim() ?? "";
    const clase = await asegurarClaseDelWorkspace(workspace.id, lessonId);
    const datos = claseSchema.parse({
      courseId: clase.courseId,
      title: formData.get("title")?.toString()?.trim() ?? "",
      description: formData.get("description")?.toString()?.trim() || null,
      isPreview: formData.get("isPreview") === "on",
    });

    await prisma.courseLesson.update({
      where: { id: lessonId },
      data: {
        title: datos.title,
        description: datos.description,
        isPreview: datos.isPreview ?? false,
      },
    });
    revalidatePath(`/dashboard/courses/${clase.courseId}`);
    return { error: null, ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar la clase." };
  }
}

export async function borrarClase(lessonId: string): Promise<CourseLessonActionState> {
  try {
    const { workspace } = await requireCoursesSalesContext();
    const clase = await asegurarClaseDelWorkspace(workspace.id, lessonId);

    await prisma.$transaction(async (tx) => {
      await tx.courseLesson.delete({ where: { id: lessonId } });
      // Renumerar: si no, queda un hueco y el orden deja de ser 0..n-1.
      const quedan = await tx.courseLesson.findMany({
        where: { courseId: clase.courseId },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      for (const [i, c] of quedan.entries()) {
        await tx.courseLesson.update({ where: { id: c.id }, data: { sortOrder: i } });
      }
    });

    logCourseEvent("clase_borrada", {
      workspaceId: workspace.id,
      courseId: clase.courseId,
      lessonId,
    });
    revalidatePath(`/dashboard/courses/${clase.courseId}`);
    return { error: null, ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo borrar la clase." };
  }
}

export async function reordenarClases(
  courseId: string,
  lessonId: string,
  destino: number,
): Promise<CourseLessonActionState> {
  try {
    const { workspace } = await requireCoursesSalesContext();
    await asegurarCursoDelWorkspace(workspace.id, courseId);

    const actuales = await prisma.courseLesson.findMany({
      where: { courseId },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    const nuevo = calcularNuevoOrden(
      actuales.map((c) => c.id),
      lessonId,
      destino,
    );

    // En una transacción: un orden a medio aplicar deja clases repetidas en pantalla.
    await prisma.$transaction(
      nuevo.map((c) =>
        prisma.courseLesson.update({ where: { id: c.id }, data: { sortOrder: c.sortOrder } }),
      ),
    );
    revalidatePath(`/dashboard/courses/${courseId}`);
    return { error: null, ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo reordenar." };
  }
}

/**
 * Pregunta al proveedor cómo viene el procesado y lo guarda.
 *
 * La pantalla la llama mientras la clase está en "Procesando…". Es de sólo lectura contra el
 * proveedor: si falla, la clase queda como estaba y se vuelve a intentar.
 */
export async function refrescarEstadoDeVideo(lessonId: string): Promise<CourseLessonActionState> {
  try {
    const { workspace } = await requireCoursesSalesContext();
    const clase = await asegurarClaseDelWorkspace(workspace.id, lessonId);
    if (!clase.videoUid) return { error: null, ok: true };

    const estado = await getVideoStatus(clase.videoUid);
    await prisma.courseLesson.update({
      where: { id: lessonId },
      data: {
        videoStatus: estado.status,
        durationSeconds: estado.durationSeconds,
        thumbnailUrl: estado.thumbnailUrl,
      },
    });
    revalidatePath(`/dashboard/courses/${clase.courseId}`);
    return { error: null, ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo consultar el estado del video.",
    };
  }
}

/**
 * Reserva el lugar del video de una clase y devuelve a dónde subirlo.
 *
 * Lo usa la ruta `/api/cursos/clases/upload-url`; el archivo no pasa por el servidor.
 */
export async function prepararSubidaDeVideo(
  lessonId: string,
): Promise<{ ok: true; uploadUrl: string } | { ok: false; error: string }> {
  const { workspace } = await requireCoursesSalesContext();
  const clase = await asegurarClaseDelWorkspace(workspace.id, lessonId);

  // Cuatro horas: una clase más larga que eso es, casi siempre, un archivo equivocado.
  const subida = await createDirectUpload({ maxDurationSeconds: 4 * 60 * 60 });

  await prisma.courseLesson.update({
    where: { id: lessonId },
    data: { videoUid: subida.uid, videoStatus: "UPLOADING" },
  });
  logCourseEvent("video_subida_preparada", {
    workspaceId: workspace.id,
    courseId: clase.courseId,
    lessonId,
  });
  return { ok: true, uploadUrl: subida.uploadUrl };
}
