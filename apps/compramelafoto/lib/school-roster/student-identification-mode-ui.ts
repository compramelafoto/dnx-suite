export type StudentIdentificationModeValue =
  | "NONE"
  | "MANUAL"
  | "ROSTER_OPTIONAL"
  | "ROSTER_REQUIRED"
  | null;

export function formatStudentIdentificationModeLabel(
  mode: StudentIdentificationModeValue
): string {
  switch (mode) {
    case "NONE":
      return "Sin identificación de alumno";
    case "MANUAL":
      return "Carga manual del alumno";
    case "ROSTER_OPTIONAL":
      return "Selección desde listado opcional";
    case "ROSTER_REQUIRED":
      return "Selección desde listado obligatoria";
    default:
      return "Sin definir";
  }
}

export function formatStudentIdentificationModeDescription(
  mode: StudentIdentificationModeValue
): string {
  switch (mode) {
    case "NONE":
      return "No se le pide al cliente que identifique al alumno.";
    case "MANUAL":
      return "El cliente escribe los datos del alumno manualmente.";
    case "ROSTER_OPTIONAL":
      return "El cliente puede elegir al alumno desde el listado cargado, pero no es obligatorio.";
    case "ROSTER_REQUIRED":
      return "El cliente debe elegir al alumno desde el listado cargado para continuar.";
    default:
      return "Definí este campo para guiar correctamente al cliente en la selección del alumno.";
  }
}

export const STUDENT_IDENTIFICATION_MODE_VALUES: Array<
  Exclude<StudentIdentificationModeValue, null>
> = ["NONE", "MANUAL", "ROSTER_OPTIONAL", "ROSTER_REQUIRED"];
