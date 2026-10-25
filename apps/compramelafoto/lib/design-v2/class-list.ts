import "server-only";
import type { Prisma } from "@/lib/prisma";
import type { ClassListGroup, ClassListStudent } from "@repo/template-engine";
import { parseExternalPreventaRefs, splitExcelStudentName } from "@/lib/canje-externo/external-preventa";
import { excelCourseKey } from "@/lib/canje-externo/valores-del-pack-externo";
import { OrderOrigin, OrderStatus } from "@/lib/prisma";
import type { CursoDelAlbum } from "./listado-cursos";
import { courseDisplayName } from "./values";

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

type CourseFields = { level?: string | null; shift?: string | null; courseName?: string | null; division?: string | null };

/** La clave de un curso del padrón: nivel, turno, curso y división. */
export function rosterCourseKey(c: CourseFields): string {
  return ["padron", c.level ?? "", c.shift ?? "", c.courseName ?? "", c.division ?? ""].map((x) => x.trim()).join("|");
}


/**
 * El curso del dueño de un diseño, con su título y su clave, para el bloque «Listado del curso».
 * Null si no se sabe el curso o no tiene alumnos.
 */
export async function loadCourseStudentGroup(
  db: Prisma.TransactionClient,
  owner: ClassListOwner,
): Promise<ClassListGroup | null> {
  const r = await loadCourseStudentListWithCourse(db, owner);
  if (!r) return null;
  const shift = r.shift?.trim();
  return {
    title: courseDisplayName(r.course.courseName, r.course.division) ?? "",
    courseKey: r.courseKey,
    ...(shift ? { shift } : {}),
    students: r.students,
  };
}

export async function loadCourseStudentList(
  db: Prisma.TransactionClient,
  owner: ClassListOwner,
): Promise<ClassListStudent[] | null> {
  return (await loadCourseStudentListWithCourse(db, owner))?.students ?? null;
}

async function loadCourseStudentListWithCourse(
  db: Prisma.TransactionClient,
  owner: ClassListOwner,
): Promise<{ students: ClassListStudent[]; course: CourseFields; courseKey: string; shift: string | null } | null> {
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
    select: {
      id: true,
      studentId: true,
      snapshotFirstName: true,
      snapshotLastName: true,
      level: true,
      shift: true,
      courseName: true,
      division: true,
    },
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
  // El curso exacto (con nivel y turno) sale de la fila del padrón del dueño o de la primera.
  const exact = ownerEntry ?? entries[0]!;
  return { students, course, courseKey: rosterCourseKey(exact), shift: exact.shift ?? null };
}

/**
 * Todos los cursos del padrón del álbum, en el orden del colegio, con sus alumnos activos.
 * Cada curso lleva su turno aparte (el listado lo imprime según «Mostrar turno», y siempre si dos
 * cursos se llaman igual). Si dos cursos coinciden en nombre y turno, el título suma el nivel.
 */
export async function loadAlbumRosterCourses(db: Prisma.TransactionClient, albumId: number): Promise<CursoDelAlbum[]> {
  const entries = await db.albumStudentRosterEntry.findMany({
    where: { albumId, isActive: true },
    orderBy: [
      { level: "asc" },
      { courseName: "asc" },
      { division: "asc" },
      { shift: "asc" },
      { snapshotLastName: "asc" },
      { snapshotFirstName: "asc" },
      { id: "asc" },
    ],
    select: { level: true, shift: true, courseName: true, division: true, snapshotFirstName: true, snapshotLastName: true },
  });
  const byKey = new Map<string, { fields: CourseFields; students: ClassListStudent[] }>();
  for (const e of entries) {
    if (!e.courseName?.trim()) continue;
    const key = rosterCourseKey(e);
    if (!byKey.has(key)) byKey.set(key, { fields: e, students: [] });
    byKey.get(key)!.students.push({ firstName: e.snapshotFirstName.trim(), lastName: e.snapshotLastName.trim() });
  }
  const cursos = [...byKey.entries()].map(([key, c]) => ({
    key,
    fields: c.fields,
    title: courseDisplayName(c.fields.courseName, c.fields.division) ?? "",
    shift: c.fields.shift?.trim() || "",
    students: c.students,
  }));
  const conTurno = cursos.map((c) => `${c.title}|${c.shift}`.toLowerCase());
  return cursos.map((c, i) => {
    const repetido = conTurno.filter((t) => t === conTurno[i]).length > 1;
    const nivel = repetido ? c.fields.level?.trim() : "";
    return {
      key: c.key,
      title: nivel ? `${c.title} · ${nivel}` : c.title,
      ...(c.shift ? { shift: c.shift } : {}),
      students: c.students,
    };
  });
}

/**
 * Los cursos de un álbum cuyos packs se cargaron del Excel (sin padrón): un curso por nombre,
 * con los alumnos de los packs pagados, sin repetir.
 */
export function cursosDeLosPacksExternos(
  packs: ReadonlyArray<{ courseName?: string | null; studentName?: string | null } | null>,
): CursoDelAlbum[] {
  const byCourse = new Map<string, { students: ClassListStudent[]; vistos: Set<string> }>();
  for (const p of packs) {
    const curso = p?.courseName?.trim();
    const nombre = p?.studentName?.trim();
    if (!curso || !nombre) continue;
    if (!byCourse.has(curso)) byCourse.set(curso, { students: [], vistos: new Set() });
    const c = byCourse.get(curso)!;
    const clave = nombre.toLowerCase();
    if (c.vistos.has(clave)) continue;
    c.vistos.add(clave);
    const partes = splitExcelStudentName(nombre);
    if (partes) c.students.push({ firstName: partes.firstName, lastName: partes.lastName });
  }
  return [...byCourse.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }))
    .map(([curso, c]) => ({ key: excelCourseKey(curso), title: curso, students: c.students }));
}

/**
 * Los cursos que se pueden sumar al listado de un diseño del álbum: los del padrón; si el álbum
 * no tiene padrón, los de los packs cargados del Excel.
 */
export async function loadAlbumCourses(db: Prisma.TransactionClient, albumId: number): Promise<CursoDelAlbum[]> {
  const padron = await loadAlbumRosterCourses(db, albumId);
  if (padron.length > 0) return padron;
  const packs = await db.order.findMany({
    where: { albumId, origin: OrderOrigin.PREVENTA_PACK, isTest: false, status: OrderStatus.PAID },
    select: { redemptionPaymentRefsJson: true },
  });
  return cursosDeLosPacksExternos(packs.map((o) => parseExternalPreventaRefs(o.redemptionPaymentRefsJson)));
}
