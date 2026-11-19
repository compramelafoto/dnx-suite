import { buildDesignValues } from "@/lib/design-v2/values";
import { armarCompaneros, type FilaDelPadron } from "@/lib/mosaico/companeros";
import { splitExcelStudentName, type ExternalPreventaRefs } from "./external-preventa";

/** «6º grado» + «A» → «6º grado a»: para comparar el curso del Excel con el del padrón. */
export function cursoComparable(...partes: Array<string | null | undefined>): string {
  return partes
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Palabras del nombre sin tildes, apóstrofos ni puntos: «L’Abbate, Inés» y «Labbate Ines» son el mismo. */
function palabrasDelNombre(...partes: string[]): string[] {
  return partes
    .join(" ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/['’´`.,]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function nombreComparable(nombre: string, apellido: string): string {
  return palabrasDelNombre(nombre, apellido).sort().join(" ");
}

/**
 * La fila del padrón del alumno del pack. Primero, el mismo nombre completo; si no, la única fila
 * que contiene todas sus palabras (el Excel trae «Bessone Julia» y la lista del colegio «Bessone,
 * Julia Ema»). Con dos candidatas no elige ninguna.
 */
function duenoEnElPadron<T extends { snapshotFirstName: string; snapshotLastName: string }>(
  padron: T[],
  partes: { firstName: string; lastName: string } | null,
): T | null {
  if (!partes) return null;
  const clave = nombreComparable(partes.firstName, partes.lastName);
  const exacto = padron.find((f) => nombreComparable(f.snapshotFirstName, f.snapshotLastName) === clave);
  if (exacto) return exacto;
  const buscadas = palabrasDelNombre(partes.firstName, partes.lastName);
  const candidatas = padron.filter((f) => {
    const tiene = new Set(palabrasDelNombre(f.snapshotFirstName, f.snapshotLastName));
    return buscadas.every((w) => tiene.has(w));
  });
  return candidatas.length === 1 ? candidatas[0]! : null;
}

/** La clave de un curso de los packs cargados del Excel (la misma que usa `class-list`). */
export function excelCourseKey(courseName: string): string {
  return `excel|${courseName.trim()}`;
}

/**
 * Los textos (y el logo) del librito de un pack cobrado por fuera, a partir del pack y de los
 * otros packs del mismo álbum. Sin base: la consulta la hace `valoresDelPackExterno`.
 *
 * El logo del colegio sale del colegio vinculado al álbum. Antes no se mandaba: una plantilla con
 * el bloque «Logo escuela» salía sin logo en los canjes de packs cargados del Excel, aunque el
 * colegio lo tuviera cargado.
 */
export function valoresDelPackExternoDesdePacks(input: {
  externo: ExternalPreventaRefs;
  /** Los packs del álbum (refs ya leídos); se usan los del mismo curso para el listado. */
  packsDelAlbum: Array<ExternalPreventaRefs | null>;
  schoolName: string | null | undefined;
  schoolLogoUrl: string | null | undefined;
  buyerName: string | null | undefined;
  photographerName: string | null | undefined;
  /**
   * Las filas del padrón del álbum que son del curso del pack, con sus retratos. Con ellas se arma
   * el «Mosaico del curso»; sin ellas, el mosaico lleva sólo los nombres de los packs del Excel.
   */
  padronDelCurso?: FilaDelPadron[];
}): Record<string, string> {
  const { externo } = input;
  const partes = splitExcelStudentName(externo.studentName);
  const vistos = new Set<string>();
  const propio = (externo.studentName ?? "").trim().toLowerCase();
  const courseStudents = externo.courseName
    ? input.packsDelAlbum
        .filter((r) => r?.courseName === externo.courseName && r.studentName)
        .flatMap((r) => {
          const clave = r!.studentName!.trim().toLowerCase();
          if (vistos.has(clave)) return [];
          vistos.add(clave);
          const p = splitExcelStudentName(r!.studentName);
          return p ? [{ ...p, isOwner: clave === propio }] : [];
        })
    : [];
  const padron = input.padronDelCurso ?? [];
  let courseMosaic: ReturnType<typeof armarCompaneros> | null = null;
  let courseMosaicOwner: ReturnType<typeof armarCompaneros>[number] | null = null;
  const dueno = padron.length > 0 ? duenoEnElPadron(padron, partes) : null;
  if (padron.length > 0) {
    courseMosaic = armarCompaneros(padron, dueno?.id ?? -1);
    courseMosaicOwner = dueno ? (armarCompaneros([dueno], -1)[0] ?? null) : null;
  } else if (courseStudents.length > 0) {
    // Sin padrón: los compañeros de los packs, sólo con su nombre (el mosaico dibuja la silueta).
    courseMosaic = courseStudents
      .filter((c) => !c.isOwner)
      .map((c) => ({ firstName: c.firstName, lastName: c.lastName }));
  }
  // Con padrón del curso, el listado es el curso completo (compraron o no); sin padrón, los
  // alumnos de los packs del Excel. Antes el padrón sólo se usaba si nadie más del curso tenía pack,
  // así que el listado salía con los que compraron y no con todo el curso.
  const listado =
    padron.length > 0
      ? padron.map((f) => ({ firstName: f.snapshotFirstName, lastName: f.snapshotLastName, isOwner: f === dueno }))
      : courseStudents;
  return buildDesignValues({
    studentName: externo.studentName,
    studentFirstName: partes?.firstName,
    studentLastName: partes?.lastName,
    courseName: externo.courseName,
    schoolName: input.schoolName ?? externo.schoolName,
    schoolLogoUrl: input.schoolLogoUrl,
    buyerName: input.buyerName,
    photographerName: input.photographerName,
    courseGroups:
      externo.courseName && listado.length
        ? [{ title: externo.courseName.trim(), courseKey: excelCourseKey(externo.courseName), students: listado }]
        : null,
    courseMosaic,
    courseMosaicOwner,
  });
}
