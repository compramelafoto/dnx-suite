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

export type RenameSchoolResult =
  | { ok: true; before: string; school: { id: number; name: string } }
  | { ok: false; status: 400 | 404; error: string };

/**
 * Cambia el nombre de una escuela del fotógrafo. Escuela ajena o inexistente → 404
 * «Escuela no encontrada»; nombre vacío → 400. Devuelve el nombre anterior para poder deshacer.
 */
export async function renameSchoolForOwner(
  ownerId: number,
  schoolId: number,
  name: string
): Promise<RenameSchoolResult> {
  const nuevo = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!nuevo) return { ok: false, status: 400, error: "El nombre es requerido" };
  const owned = await findOwnedSchool(ownerId, schoolId);
  if (!owned) return { ok: false, status: 404, error: "Escuela no encontrada" };
  const school = await prisma.school.update({
    where: { id: schoolId },
    data: { name: nuevo },
    select: { id: true, name: true },
  });
  return { ok: true, before: owned.name, school };
}

/**
 * Lo que impide borrar una escuela. Borrarla en la base arrastra (en cascada) alumnos,
 * inscripciones, listas, administradores y comisiones anotadas, y desvincula sus álbumes:
 * por eso sólo se deja borrar una escuela «vacía» (sólo con cursos o invitaciones pendientes).
 */
export type SchoolDeletionBlockers = {
  albums: number;
  students: number;
  organizers: number;
  commissions: number;
};

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Texto para el fotógrafo con lo que frena el borrado, o `null` si se puede borrar. */
export function describeSchoolDeletionBlockers(b: SchoolDeletionBlockers): string | null {
  const partes: string[] = [];
  if (b.albums > 0) partes.push(plural(b.albums, "álbum vinculado", "álbumes vinculados"));
  if (b.students > 0) partes.push(plural(b.students, "alumno cargado", "alumnos cargados"));
  if (b.organizers > 0) partes.push(plural(b.organizers, "administrador de la escuela", "administradores de la escuela"));
  if (b.commissions > 0) partes.push(plural(b.commissions, "comisión anotada", "comisiones anotadas"));
  if (partes.length === 0) return null;
  const lista =
    partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
  return `No se puede eliminar porque tiene ${lista}. Si es la escuela equivocada, cambiale el nombre en lugar de borrarla.`;
}

export type SchoolForDeletion = {
  id: number;
  name: string;
  courses: number;
  blockers: SchoolDeletionBlockers;
  /** Texto con lo que frena el borrado, o `null` si se puede borrar. */
  blockedReason: string | null;
};

/** Escuela del fotógrafo con lo necesario para decidir si se puede borrar; `null` si no es suya. */
export async function getSchoolForDeletion(ownerId: number, schoolId: number): Promise<SchoolForDeletion | null> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      _count: { select: { albums: true, students: true, organizers: true, organizerCommissions: true, courses: true } },
    },
  });
  if (!school || school.ownerId !== ownerId) return null;
  const blockers: SchoolDeletionBlockers = {
    albums: school._count.albums,
    students: school._count.students,
    organizers: school._count.organizers,
    commissions: school._count.organizerCommissions,
  };
  return {
    id: school.id,
    name: school.name,
    courses: school._count.courses,
    blockers,
    blockedReason: describeSchoolDeletionBlockers(blockers),
  };
}

export type DeleteSchoolResult =
  | { ok: true; school: { id: number; name: string } }
  | { ok: false; status: 404 | 409; error: string };

/**
 * Borra una escuela del fotógrafo sólo si está vacía (ver `SchoolDeletionBlockers`).
 * Se revisa y se borra dentro de la misma transacción para que nada se cuele en el medio.
 */
export async function deleteSchoolForOwner(ownerId: number, schoolId: number): Promise<DeleteSchoolResult> {
  return prisma.$transaction(async (tx) => {
    const school = await tx.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        _count: { select: { albums: true, students: true, organizers: true, organizerCommissions: true } },
      },
    });
    if (!school || school.ownerId !== ownerId) {
      return { ok: false as const, status: 404 as const, error: "Escuela no encontrada" };
    }
    const motivo = describeSchoolDeletionBlockers({
      albums: school._count.albums,
      students: school._count.students,
      organizers: school._count.organizers,
      commissions: school._count.organizerCommissions,
    });
    if (motivo) return { ok: false as const, status: 409 as const, error: motivo };
    await tx.school.delete({ where: { id: schoolId } });
    return { ok: true as const, school: { id: school.id, name: school.name } };
  });
}
