/**
 * Progreso del curso en la base (tabla CamOfDutyLessonProgress): se guarda la
 * mejor nota de cada lección y cuántas veces se intentó.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gradeShot } from "./grade";
import { lessonById } from "./lessons";
import type { LessonProgress } from "./progress";
import type { GradeResult, Shot } from "./types";

export async function loadCourseProgress(userId: number): Promise<LessonProgress[]> {
  try {
    const rows = await prisma.camOfDutyLessonProgress.findMany({ where: { userId } });
    return rows.map((r) => ({ lessonId: r.lessonId, stars: r.stars, attempts: r.attempts, passedAt: r.passedAt?.toISOString() ?? null }));
  } catch (error) {
    // Sin la tabla (otra base) o con la base caída, el curso se muestra igual, sin progreso.
    console.error("[camofduty] no se pudo leer el progreso del curso", { userId, error });
    return [];
  }
}

/** Corrige la toma y guarda la mejor nota. Devuelve la nota de esta toma y la mejor guardada. */
export async function recordLessonAttempt(
  userId: number,
  lessonId: string,
  shot: Shot,
): Promise<{ grade: GradeResult; best: number } | null> {
  const lesson = lessonById(lessonId);
  if (!lesson) return null;
  const grade = gradeShot(lesson, shot);
  const now = new Date();
  const existing = await prisma.camOfDutyLessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
  const improves = grade.stars > (existing?.stars ?? 0);
  const row = await prisma.camOfDutyLessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: {
      userId,
      lessonId,
      stars: grade.stars,
      attempts: 1,
      passedAt: grade.passed ? now : null,
      bestShot: grade.passed ? (shot as unknown as Prisma.InputJsonValue) : undefined,
    },
    update: {
      attempts: { increment: 1 },
      ...(improves
        ? { stars: grade.stars, bestShot: shot as unknown as Prisma.InputJsonValue, ...(existing?.passedAt ? {} : { passedAt: now }) }
        : {}),
    },
  });
  return { grade, best: row.stars };
}
