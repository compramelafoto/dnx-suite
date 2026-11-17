/**
 * Alumno y curso de un pedido escolar canjeado desde un pack cobrado por fuera
 * (`redemptionPaymentRefsJson.kind = EXTERNAL_PREVENTA_PACK`). El pedido canjeado guarda como
 * comprador al adulto (la madre o el padre); para imprimir y embolsar hace falta el alumno y su curso,
 * como en los libritos.
 */

export type AlumnoDelPedido = { alumno: string; curso: string | null };

export function alumnoDesdeRefs(refs: unknown): AlumnoDelPedido | null {
  if (!refs || typeof refs !== "object") return null;
  const r = refs as Record<string, unknown>;
  if (r.kind !== "EXTERNAL_PREVENTA_PACK") return null;
  const alumno = typeof r.studentName === "string" ? r.studentName.trim() : "";
  if (!alumno) return null;
  const curso = typeof r.courseName === "string" && r.courseName.trim() ? r.courseName.trim() : null;
  return { alumno, curso };
}

/** "7° Grado B" → "7B"; "Sala 3A" queda igual. Para que el nombre del alumno entre en la carpeta. */
export function cursoCorto(curso: string): string {
  return curso
    .replace(/\s*[°º]?\s*grado\s*/i, "")
    .replace(/[°º]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nombre de la carpeta del pedido: "7B Lozano Esmeralda". */
export function rotuloDeAlumno(a: AlumnoDelPedido): string {
  return a.curso ? `${cursoCorto(a.curso)} ${a.alumno}` : a.alumno;
}
