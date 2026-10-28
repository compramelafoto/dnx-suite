import {
  CLASS_LIST_VARIABLE_KEY,
  COURSE_MOSAIC_VARIABLE_KEY,
  COURSE_MOSAIC_OWNER_VARIABLE_KEY,
  parseCourseMosaic,
  parseCourseMosaicOwner,
  serializeCourseMosaicOwner,
  serializeCourseMosaic,
  type CourseMosaicStudent,
  formatCourseName,
  serializeClassListGroups,
  type ClassListGroup,
  type ClassListStudent,
} from "@repo/template-engine";

/**
 * Los textos que llenan las variables de una plantilla (alumno, curso, escuela, comprador…).
 *
 * Las claves son las del catálogo escolar del diseñador. Lo que no se sabe no se manda: la
 * plantilla usa su texto de respaldo.
 */
export type DesignValueSources = {
  studentName?: string | null;
  /**
   * Nombre y apellido por separado, para los formatos «Apellido, Nombre», «Nombre» y
   * «Apellido». Sin ellos esos formatos usan su texto de respaldo: partir un nombre completo
   * adivinando dónde termina el apellido saldría mal con los apellidos compuestos.
   */
  studentFirstName?: string | null;
  studentLastName?: string | null;
  courseName?: string | null;
  /** El turno del curso («Mañana»), para el título del listado cuando sale de `courseStudents`. */
  courseShift?: string | null;
  schoolName?: string | null;
  schoolLogoUrl?: string | null;
  buyerName?: string | null;
  photographerName?: string | null;
  photographerLogoUrl?: string | null;
  eventDate?: Date | null;
  orderReference?: string | null;
  /**
   * Los alumnos del curso, para el bloque «Listado del curso». Se guardan como un curso con el
   * título `courseName`. Para varios cursos (o con su clave del padrón), `courseGroups`.
   */
  courseStudents?: ClassListStudent[] | null;
  /** Los cursos del listado, cada uno con su título. Manda sobre `courseStudents`. */
  courseGroups?: ClassListGroup[] | null;
  /** Los compañeros del bloque «Mosaico del curso», ya sin el dueño del diseño. */
  courseMosaic?: CourseMosaicStudent[] | null;
  /** El dueño, para los bloques con «Incluir al dueño» (la plancha de figuritas). */
  courseMosaicOwner?: CourseMosaicStudent | null;
};

const DATE_FORMAT = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function buildDesignValues(src: DesignValueSources): Record<string, string> {
  const values: Record<string, string> = {};
  const put = (key: string, value: string | null | undefined) => {
    const v = value?.trim();
    if (v) values[key] = v;
  };
  const first = src.studentFirstName?.trim() || "";
  const last = src.studentLastName?.trim() || "";
  put("student.fullName", src.studentName || [first, last].filter(Boolean).join(" "));
  put("student.firstName", first);
  put("student.lastName", last);
  if (first && last) put("student.lastNameFirst", `${last}, ${first}`);
  else put("student.lastNameFirst", last || first);
  put("course.displayName", src.courseName);
  put("school.name", src.schoolName);
  // Curso y colegio en un mismo texto, en los dos órdenes. Si falta uno, va el que hay.
  const curso = src.courseName?.trim() || "";
  const colegio = src.schoolName?.trim() || "";
  put("course.withSchool", [curso, colegio].filter(Boolean).join(" - "));
  put("school.withCourse", [colegio, curso].filter(Boolean).join(" - "));
  put("branding.schoolLogoUrl", src.schoolLogoUrl);
  put("buyer.fullName", src.buyerName);
  put("photographer.displayName", src.photographerName);
  put("branding.photographerLogoUrl", src.photographerLogoUrl);
  put("order.referenceShort", src.orderReference);
  const groups = src.courseGroups?.filter((g) => g.students.length > 0).length
    ? src.courseGroups.filter((g) => g.students.length > 0)
    : src.courseStudents?.length
      ? [
          {
            title: src.courseName?.trim() || "",
            ...(src.courseShift?.trim() ? { shift: src.courseShift.trim() } : {}),
            students: src.courseStudents,
          },
        ]
      : [];
  if (groups.length) values[CLASS_LIST_VARIABLE_KEY] = serializeClassListGroups(groups);
  if (src.courseMosaic?.length) values[COURSE_MOSAIC_VARIABLE_KEY] = serializeCourseMosaic(src.courseMosaic);
  if (src.courseMosaicOwner) values[COURSE_MOSAIC_OWNER_VARIABLE_KEY] = serializeCourseMosaicOwner(src.courseMosaicOwner);
  if (src.eventDate && !Number.isNaN(src.eventDate.getTime())) {
    put("event.dateFormatted", DATE_FORMAT.format(src.eventDate));
  }
  return values;
}

/**
 * El curso para imprimir: "3" + "B" → "3° B"; "3º" + "B" → "3º B". Es la misma escritura que
 * el título del curso en el «Listado del curso» (`formatCourseName`), así el «Curso» del diseño
 * y el título del listado dicen lo mismo.
 */
export function courseDisplayName(name?: string | null, division?: string | null): string | null {
  const parts = [name?.trim(), division?.trim()].filter(Boolean);
  return parts.length ? formatCourseName(parts.join(" ")) || null : null;
}

/**
 * Los compañeros del mosaico que se imprimen. Sin valor guardado, ninguno: los compañeros de
 * muestra son sólo para el editor y las vistas de ejemplo, nunca para una carpeta real.
 */
export function courseMosaicForPrint(values: Record<string, string>): CourseMosaicStudent[] {
  return parseCourseMosaic(values[COURSE_MOSAIC_VARIABLE_KEY]);
}

/** El dueño de la carpeta para los bloques con «Incluir al dueño». */
export function courseMosaicOwnerForPrint(values: Record<string, string>): CourseMosaicStudent | null {
  return parseCourseMosaicOwner(values[COURSE_MOSAIC_OWNER_VARIABLE_KEY]);
}
