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

function nombreComparable(nombre: string, apellido: string): string {
  return cursoComparable(...[...nombre.split(/\s+/), ...apellido.split(/\s+/)].sort());
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
  if (padron.length > 0) {
    const claveDueno = partes ? nombreComparable(partes.firstName, partes.lastName) : null;
    const dueno = padron.find((f) => nombreComparable(f.snapshotFirstName, f.snapshotLastName) === claveDueno);
    courseMosaic = armarCompaneros(padron, dueno?.id ?? -1);
    courseMosaicOwner = dueno ? (armarCompaneros([dueno], -1)[0] ?? null) : null;
  } else if (courseStudents.length > 0) {
    // Sin padrón: los compañeros de los packs, sólo con su nombre (el mosaico dibuja la silueta).
    courseMosaic = courseStudents
      .filter((c) => !c.isOwner)
      .map((c) => ({ firstName: c.firstName, lastName: c.lastName }));
  }
  // Sin otros packs del curso, el listado sale del padrón.
  const listado =
    courseStudents.length > 0
      ? courseStudents
      : padron.map((f) => ({
          firstName: f.snapshotFirstName,
          lastName: f.snapshotLastName,
          isOwner: courseMosaicOwner != null && f.snapshotFirstName === courseMosaicOwner.firstName && f.snapshotLastName === courseMosaicOwner.lastName,
        }));
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
