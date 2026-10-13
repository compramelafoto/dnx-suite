import { CLASS_LIST_VARIABLE_KEY, serializeClassList, type ClassListStudent } from "@repo/template-engine";

/**
 * Los textos que llenan las variables de una plantilla (alumno, curso, escuela, comprador…).
 *
 * Las claves son las del catálogo escolar del diseñador. Lo que no se sabe no se manda: la
 * plantilla usa su texto de respaldo.
 */
export type DesignValueSources = {
  studentName?: string | null;
  courseName?: string | null;
  schoolName?: string | null;
  schoolLogoUrl?: string | null;
  buyerName?: string | null;
  photographerName?: string | null;
  photographerLogoUrl?: string | null;
  eventDate?: Date | null;
  orderReference?: string | null;
  /** Los alumnos del curso, para el bloque «Listado del curso». */
  courseStudents?: ClassListStudent[] | null;
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
  put("student.fullName", src.studentName);
  put("course.displayName", src.courseName);
  put("school.name", src.schoolName);
  put("branding.schoolLogoUrl", src.schoolLogoUrl);
  put("buyer.fullName", src.buyerName);
  put("photographer.displayName", src.photographerName);
  put("branding.photographerLogoUrl", src.photographerLogoUrl);
  put("order.referenceShort", src.orderReference);
  if (src.courseStudents?.length) values[CLASS_LIST_VARIABLE_KEY] = serializeClassList(src.courseStudents);
  if (src.eventDate && !Number.isNaN(src.eventDate.getTime())) {
    put("event.dateFormatted", DATE_FORMAT.format(src.eventDate));
  }
  return values;
}

/** "3.º" + "B" → "3.º B". */
export function courseDisplayName(name?: string | null, division?: string | null): string | null {
  const parts = [name?.trim(), division?.trim()].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}
