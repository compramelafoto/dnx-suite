/**
 * Aliases legibles Template V2 → paths canónicos.
 * Fuente: apps/compramelafoto/lib/template-v2/resolve-text-brace-variables.ts
 */
export const SCHOOL_TEMPLATE_ALIASES: Record<string, string> = {
  nombredelalumno: "student.fullName",
  nombredealumno: "student.fullName",
  nombrecompleto: "student.fullName",
  alumno: "student.fullName",
  apellido: "student.fullName",
  cliente: "buyer.fullName",
  comprador: "buyer.fullName",
  escuela: "school.name",
  colegio: "school.name",
  curso: "course.displayName",
  division: "course.displayName",
  anio: "event.dateFormatted",
  ano: "event.dateFormatted",
  fecha: "event.dateFormatted",
  pedido: "order.referenceShort",
  referencia: "order.referenceShort",
  qr: "order.fulfillmentQrUrl",
  fotografo: "photographer.displayName",
};
