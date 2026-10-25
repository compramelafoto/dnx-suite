/**
 * Formatos de un dato variable: el mismo dato escrito de otra manera. Cada formato es una
 * variable propia del catálogo escolar (ver `plugins/school/definitions.ts`), así el armado del
 * libro la resuelve igual que cualquier otra; el selector "Formato" del inspector sólo cambia
 * cuál muestra el bloque.
 */
export type VariableTextFormat = { key: string; label: string };

export const STUDENT_NAME_FORMATS: VariableTextFormat[] = [
  { key: "student.fullName", label: "Nombre Apellido" },
  { key: "student.lastNameFirst", label: "Apellido, Nombre" },
  { key: "student.firstName", label: "Nombre" },
  { key: "student.lastName", label: "Apellido" },
];

export const COURSE_SCHOOL_FORMATS: VariableTextFormat[] = [
  { key: "course.displayName", label: "Curso" },
  { key: "school.name", label: "Colegio" },
  { key: "course.withSchool", label: "Curso - Colegio" },
  { key: "school.withCourse", label: "Colegio - Curso" },
];

/** Los formatos que ofrece un dato, o `null` si no tiene otros. */
export function variableTextFormatsFor(variableKey: string): VariableTextFormat[] | null {
  for (const familia of [STUDENT_NAME_FORMATS, COURSE_SCHOOL_FORMATS]) {
    if (familia.some((f) => f.key === variableKey)) return familia;
  }
  return null;
}
