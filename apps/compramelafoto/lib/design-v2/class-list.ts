import "server-only";
import type { Prisma } from "@/lib/prisma";
import type { ClassListStudent } from "@repo/template-engine";

/**
 * Los alumnos del curso del dueño de un diseño, para el bloque «Listado del curso».
 *
 * Sale del padrón del álbum (`AlbumStudentRosterEntry`): es la lista que el fotógrafo cargó o
 * sincronizó con la escuela para esa sesión. El curso se reconoce por la fila del padrón del
 * alumno; si el pedido no quedó atado al padrón, por el curso que se anotó al comprar.
 */
export type ClassListOwner = {
  albumId: number;
  albumRosterEntryId?: number | null;
  studentId?: number | null;
  firstName?: string | null;
  lastName?: string | null;
  level?: string | null;
  shift?: string | null;
  courseName?: string | null;
  division?: string | null;
};

function normalizeName(first?: string | null, last?: string | null): string {
  return `${first ?? ""} ${last ?? ""}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function clean(v?: string | null): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export async function loadCourseStudentList(
  db: Prisma.TransactionClient,
  owner: ClassListOwner,
): Promise<ClassListStudent[] | null> {
  const rosterSelect = { id: true, studentId: true, level: true, shift: true, courseName: true, division: true } as const;
  const ownerEntry = owner.albumRosterEntryId
    ? await db.albumStudentRosterEntry.findFirst({
        where: { id: owner.albumRosterEntryId, albumId: owner.albumId },
        select: rosterSelect,
      })
    : owner.studentId
      ? await db.albumStudentRosterEntry.findUnique({
          where: { albumId_studentId: { albumId: owner.albumId, studentId: owner.studentId } },
          select: rosterSelect,
        })
      : null;

  // Con la fila del padrón el curso es exacto; con lo anotado al comprar, se filtra por lo que haya.
  const course = ownerEntry
    ? { courseName: ownerEntry.courseName, division: ownerEntry.division, level: ownerEntry.level, shift: ownerEntry.shift }
    : {
        courseName: clean(owner.courseName),
        division: clean(owner.division),
        level: clean(owner.level),
        shift: clean(owner.shift),
      };
  if (!course.courseName) return null;

  const entries = await db.albumStudentRosterEntry.findMany({
    where: {
      albumId: owner.albumId,
      isActive: true,
      courseName: course.courseName,
      ...(course.division != null ? { division: course.division } : {}),
      ...(course.level ? { level: course.level } : {}),
      ...(course.shift ? { shift: course.shift } : {}),
    },
    orderBy: [{ snapshotLastName: "asc" }, { snapshotFirstName: "asc" }, { id: "asc" }],
    select: { id: true, studentId: true, snapshotFirstName: true, snapshotLastName: true },
  });
  if (entries.length === 0) return null;

  const ownerName = normalizeName(owner.firstName, owner.lastName);
  let ownerFound = false;
  const students: ClassListStudent[] = entries.map((e) => {
    const isOwner =
      !ownerFound &&
      ((ownerEntry != null && e.id === ownerEntry.id) ||
        (owner.studentId != null && e.studentId === owner.studentId) ||
        (ownerEntry == null &&
          ownerName !== "" &&
          normalizeName(e.snapshotFirstName, e.snapshotLastName) === ownerName));
    if (isOwner) ownerFound = true;
    const s: ClassListStudent = { firstName: e.snapshotFirstName.trim(), lastName: e.snapshotLastName.trim() };
    return isOwner ? { ...s, isOwner: true } : s;
  });

  // Un alumno anotado a mano que no está en el padrón igual tiene que figurar en su carpeta.
  if (!ownerFound && ownerName !== "") {
    students.push({ firstName: clean(owner.firstName) ?? "", lastName: clean(owner.lastName) ?? "", isOwner: true });
  }
  return students;
}
