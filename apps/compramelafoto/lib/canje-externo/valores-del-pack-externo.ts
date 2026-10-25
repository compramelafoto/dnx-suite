import { buildDesignValues } from "@/lib/design-v2/values";
import { splitExcelStudentName, type ExternalPreventaRefs } from "./external-preventa";

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
      externo.courseName && courseStudents.length
        ? [{ title: externo.courseName.trim(), courseKey: excelCourseKey(externo.courseName), students: courseStudents }]
        : null,
  });
}
