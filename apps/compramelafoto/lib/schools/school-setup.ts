/**
 * Alta de escuelas y cursos del fotógrafo.
 *
 * Es el mismo código que tenían los POST de `app/api/fotografo/schools/route.ts` y
 * `app/api/fotografo/schools/[id]/courses/route.ts`, movido sin cambios: mismos
 * textos de error, mismos códigos y mismo orden de validación. Las rutas lo siguen
 * usando y DNX Bot también.
 *
 * Cursos: la ruta del panel llama con `skipExisting: false` (crea aunque ya exista
 * uno igual, como siempre). El bot usa `skipExisting: true`, que saltea los cursos
 * cuyo nombre + división ya existen en la escuela (sin distinguir mayúsculas ni espacios).
 */
import { prisma } from "@/lib/prisma";
import type { School, SchoolCourse } from "@/lib/prisma";

export type CreateSchoolInput = {
  name: unknown;
  city?: unknown;
  province?: unknown;
  contactEmail?: unknown;
  contactPhone?: unknown;
  address?: unknown;
  country?: unknown;
  notes?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  logoUrl?: unknown;
};

export type CreateSchoolResult =
  | { ok: true; school: School }
  | { ok: false; status: 400; error: string };

/** Crea una escuela del fotógrafo. Devuelve la fila completa (la ruta la responde tal cual). */
export async function createSchoolForOwner(
  ownerId: number,
  input: CreateSchoolInput
): Promise<CreateSchoolResult> {
  // El cuerpo no viene tipado: se lee crudo para conservar el comportamiento de la ruta.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = input as Record<string, any>;
  const name = String(body.name ?? "").trim();
  if (!name) {
    return { ok: false, status: 400, error: "El nombre es requerido" };
  }

  const school = await prisma.school.create({
    data: {
      ownerId,
      name,
      contactEmail: body.contactEmail ? String(body.contactEmail).trim() : null,
      contactPhone: body.contactPhone ? String(body.contactPhone).trim() : null,
      notes: body.notes ? String(body.notes).trim() : null,
      address: body.address ? String(body.address).trim() : null,
      city: body.city ? String(body.city).trim() : null,
      province: body.province ? String(body.province).trim() : null,
      country: body.country ? String(body.country).trim() : null,
      latitude: typeof body.latitude === "number" && Number.isFinite(body.latitude) ? body.latitude : null,
      longitude: typeof body.longitude === "number" && Number.isFinite(body.longitude) ? body.longitude : null,
      logoUrl:
        typeof body.logoUrl === "string" && body.logoUrl.trim()
          ? String(body.logoUrl).trim()
          : null,
    },
  });

  return { ok: true, school };
}

/**
 * Escuela del fotógrafo, o `null` si no existe o es de otro (no se distingue, para
 * no revelar que existe).
 */
export async function findOwnedSchool(
  ownerId: number,
  schoolId: number
): Promise<{ id: number; name: string } | null> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true, ownerId: true },
  });
  if (!school || school.ownerId !== ownerId) return null;
  return { id: school.id, name: school.name };
}

export type SchoolCourseInput = {
  name: unknown;
  division?: unknown;
  sortOrder?: unknown;
};

export type CreateSchoolCoursesResult =
  | { ok: true; created: number; skipped: number; courses: SchoolCourse[] }
  | { ok: false; status: 400 | 404; error: string };

/** Clave para comparar cursos: nombre + división, sin mayúsculas ni espacios. */
export function schoolCourseKey(name: string, division: string | null | undefined): string {
  const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, "");
  return `${norm(name)}|${norm(division)}`;
}

/**
 * Crea cursos en una escuela del fotógrafo. Escuela ajena o inexistente → 404
 * «Escuela no encontrada». Si algún curso no tiene nombre → 400 sin crear ninguno.
 * Se crean todos juntos (o ninguno).
 */
export async function createSchoolCoursesForOwner(
  ownerId: number,
  schoolId: number,
  courses: SchoolCourseInput[],
  opts: { skipExisting: boolean }
): Promise<CreateSchoolCoursesResult> {
  const owned = await findOwnedSchool(ownerId, schoolId);
  if (!owned) {
    return { ok: false, status: 404, error: "Escuela no encontrada" };
  }

  const rows: Array<{ schoolId: number; name: string; division: string | null; sortOrder: number | null }> = [];
  for (const course of courses) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = course as Record<string, any>;
    const name = String(body.name ?? "").trim();
    if (!name) {
      return { ok: false, status: 400, error: "El nombre del curso es requerido" };
    }

    const division = body.division ? String(body.division).trim() : null;
    const sortOrder = body.sortOrder != null ? Number(body.sortOrder) : null;

    rows.push({
      schoolId,
      name,
      division: division || null,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : null,
    });
  }

  let toCreate = rows;
  if (opts.skipExisting) {
    const existing = await prisma.schoolCourse.findMany({
      where: { schoolId },
      select: { name: true, division: true },
    });
    const seen = new Set(existing.map((c) => schoolCourseKey(c.name, c.division)));
    toCreate = [];
    for (const row of rows) {
      const key = schoolCourseKey(row.name, row.division);
      if (seen.has(key)) continue;
      seen.add(key);
      toCreate.push(row);
    }
  }

  const created =
    toCreate.length === 0
      ? []
      : await prisma.$transaction(toCreate.map((data) => prisma.schoolCourse.create({ data })));

  return { ok: true, created: created.length, skipped: rows.length - created.length, courses: created };
}
