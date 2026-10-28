import {
  CLASS_LIST_SAMPLE,
  CLASS_LIST_VARIABLE_KEY,
  COURSE_MOSAIC_SAMPLE,
  COURSE_MOSAIC_VARIABLE_KEY,
  serializeClassList,
  serializeCourseMosaic,
  type ClassListStudent,
} from "@repo/template-engine";
import { buildDesignValues, courseDisplayName } from "./values";

/**
 * «Probar» una plantilla con el listado real de un curso del fotógrafo: arma los cursos del
 * padrón de la escuela, los textos del alumno elegido (y sus compañeros en el listado y el
 * mosaico) y el paso de un alumno al siguiente.
 *
 * Puro (sin base): lo usa la pantalla de prueba en el navegador y los tests.
 */

/** Una fila del padrón de la escuela, como la devuelve `/api/fotografo/schools/[id]/roster-entries`. */
export type FilaDelPadron = {
  studentId?: number | null;
  level?: string | null;
  shift?: string | null;
  courseName?: string | null;
  division?: string | null;
  snapshotFirstName: string;
  snapshotLastName: string;
};

/** Un curso del padrón de la escuela con sus alumnos, sin repetir, ordenados por apellido. */
export type CursoDelPadron = {
  key: string;
  /** «7° A» (con el nivel si hay dos cursos que se llaman igual en el mismo turno). */
  title: string;
  shift?: string;
  students: ClassListStudent[];
};

function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const comparar = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });

/** La clave del curso: nivel, turno, curso y división (la misma forma que en el padrón del álbum). */
function claveDelCurso(f: FilaDelPadron): string {
  return ["padron", f.level ?? "", f.shift ?? "", f.courseName ?? "", f.division ?? ""].map((x) => x.trim()).join("|");
}

/**
 * Los cursos del padrón de la escuela. El padrón se guarda por álbum: un mismo alumno puede
 * estar en varios álbumes de la escuela, y acá aparece una sola vez (por su id o, si no tiene,
 * por su nombre).
 */
export function cursosDelPadronDeLaEscuela(filas: readonly FilaDelPadron[]): CursoDelPadron[] {
  const porClave = new Map<string, { fila: FilaDelPadron; students: ClassListStudent[]; vistos: Set<string> }>();
  for (const f of filas) {
    if (!f.courseName?.trim()) continue;
    const firstName = f.snapshotFirstName?.trim() ?? "";
    const lastName = f.snapshotLastName?.trim() ?? "";
    if (!firstName && !lastName) continue;
    const key = claveDelCurso(f);
    if (!porClave.has(key)) porClave.set(key, { fila: f, students: [], vistos: new Set() });
    const c = porClave.get(key)!;
    const porNombre = `nombre:${normalizar(`${firstName} ${lastName}`)}`;
    const porId = f.studentId != null ? `id:${f.studentId}` : null;
    if (c.vistos.has(porNombre) || (porId && c.vistos.has(porId))) continue;
    c.vistos.add(porNombre);
    if (porId) c.vistos.add(porId);
    c.students.push({ firstName, lastName });
  }
  const cursos = [...porClave.entries()]
    .map(([key, c]) => ({
      key,
      fila: c.fila,
      title: courseDisplayName(c.fila.courseName, c.fila.division) ?? "",
      shift: c.fila.shift?.trim() || "",
      students: [...c.students].sort((a, b) => comparar(a.lastName, b.lastName) || comparar(a.firstName, b.firstName)),
    }))
    .sort(
      (a, b) =>
        comparar(a.fila.level ?? "", b.fila.level ?? "") ||
        comparar(a.fila.courseName ?? "", b.fila.courseName ?? "") ||
        comparar(a.fila.division ?? "", b.fila.division ?? "") ||
        comparar(a.shift, b.shift),
    );
  const conTurno = cursos.map((c) => `${c.title}|${c.shift}`.toLowerCase());
  return cursos.map((c, i) => {
    const repetido = conTurno.filter((t) => t === conTurno[i]).length > 1;
    const nivel = repetido ? c.fila.level?.trim() : "";
    return {
      key: c.key,
      title: nivel ? `${c.title} ${nivel}` : c.title,
      ...(c.shift ? { shift: c.shift } : {}),
      students: c.students,
    };
  });
}

/** Las claves que llena el listado elegido: al cambiar de alumno (o volver al ejemplo) se reemplazan todas. */
export const CLAVES_DEL_LISTADO = [
  "student.fullName",
  "student.firstName",
  "student.lastName",
  "student.lastNameFirst",
  "course.displayName",
  "course.withSchool",
  "school.withCourse",
  "school.name",
  "branding.schoolLogoUrl",
  CLASS_LIST_VARIABLE_KEY,
  COURSE_MOSAIC_VARIABLE_KEY,
] as const;

/** Los textos de muestra de siempre: un alumno inventado y compañeros de muestra. */
export function valoresDeEjemplo(): Record<string, string> {
  return {
    "student.fullName": "Nombre del Alumno",
    "course.displayName": "5º A",
    "school.name": "Escuela de prueba",
    [CLASS_LIST_VARIABLE_KEY]: serializeClassList(CLASS_LIST_SAMPLE),
    // Compañeros de muestra en el mosaico (sin fotos: siluetas).
    [COURSE_MOSAIC_VARIABLE_KEY]: serializeCourseMosaic(COURSE_MOSAIC_SAMPLE),
  };
}

/**
 * Los textos del diseño para el alumno número `indice` del curso: su nombre, el curso y la
 * escuela, el listado con todo el curso (él marcado) y el mosaico con sus compañeros (sin él).
 */
export function valoresDelAlumno(input: {
  curso: CursoDelPadron;
  indice: number;
  schoolName?: string | null;
  schoolLogoUrl?: string | null;
}): Record<string, string> {
  const { curso } = input;
  if (curso.students.length === 0) return {};
  const indice = indiceValido(input.indice, curso.students.length);
  const alumno = curso.students[indice]!;
  return buildDesignValues({
    studentFirstName: alumno.firstName,
    studentLastName: alumno.lastName,
    courseName: curso.title,
    schoolName: input.schoolName,
    schoolLogoUrl: input.schoolLogoUrl,
    courseGroups: [
      {
        title: curso.title,
        courseKey: curso.key,
        ...(curso.shift ? { shift: curso.shift } : {}),
        students: curso.students.map((s, i) => (i === indice ? { ...s, isOwner: true } : { ...s })),
      },
    ],
    courseMosaic: curso.students
      .filter((_, i) => i !== indice)
      .map((s) => ({ firstName: s.firstName, lastName: s.lastName })),
  });
}

/** Los textos del diseño con los del listado reemplazados (lo demás que corrigió el fotógrafo queda). */
export function reemplazarValoresDelListado(
  actuales: Record<string, string>,
  delListado: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...actuales };
  for (const k of CLAVES_DEL_LISTADO) delete out[k];
  return { ...out, ...delListado };
}

function indiceValido(indice: number, total: number): number {
  if (total <= 0 || !Number.isFinite(indice)) return 0;
  return Math.min(Math.max(Math.trunc(indice), 0), total - 1);
}

/** El alumno anterior (`paso` -1) o el siguiente (+1); del último se vuelve al primero y al revés. */
export function moverAlumno(indice: number, total: number, paso: number): number {
  if (total <= 0) return 0;
  const i = indiceValido(indice, total);
  return (((i + Math.trunc(paso)) % total) + total) % total;
}

/** «Alumno 3 de 20». */
export function etiquetaDelAlumno(indice: number, total: number): string {
  if (total <= 0) return "Sin alumnos";
  return `Alumno ${indiceValido(indice, total) + 1} de ${total}`;
}
