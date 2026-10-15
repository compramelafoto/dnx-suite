import type { DemoDePlantilla } from "./demo-de-plantilla";
import { buildDesignValues } from "./values";

/** Los textos de la plantilla con los datos de la demo. Sin logo, el bloque del logo no se muestra. */
export function valoresDeDemo(demo: DemoDePlantilla, logoUrl: string | null): Record<string, string> {
  return buildDesignValues({
    studentFirstName: demo.alumno.firstName,
    studentLastName: demo.alumno.lastName,
    courseName: demo.curso,
    schoolName: demo.colegio,
    schoolLogoUrl: logoUrl,
    buyerName: `Familia ${demo.alumno.lastName}`,
    photographerName: "Tu estudio de fotografía",
    courseStudents: demo.companeros,
  });
}
