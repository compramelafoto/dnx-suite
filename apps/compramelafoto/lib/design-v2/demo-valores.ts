import { mosaicoDeDemo, type DemoDePlantilla } from "./demo-de-plantilla";
import { buildDesignValues } from "./values";

/**
 * Los textos de la plantilla con los datos de la demo. Sin logo, el bloque del logo no se muestra.
 * Con `urlDeRetrato`, el mosaico del curso lleva retratos de demo (los que estén subidos).
 */
export function valoresDeDemo(
  demo: DemoDePlantilla,
  logoUrl: string | null,
  urlDeRetrato?: (archivo: string) => string | null,
): Record<string, string> {
  return buildDesignValues({
    studentFirstName: demo.alumno.firstName,
    studentLastName: demo.alumno.lastName,
    courseName: demo.curso,
    courseShift: demo.turno,
    schoolName: demo.colegio,
    schoolLogoUrl: logoUrl,
    buyerName: `Familia ${demo.alumno.lastName}`,
    photographerName: "Tu estudio de fotografía",
    courseStudents: demo.companeros,
    courseMosaic: mosaicoDeDemo(demo, urlDeRetrato ?? (() => null)),
  });
}
