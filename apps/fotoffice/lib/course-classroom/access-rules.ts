/**
 * Reglas del acceso de un alumno a un curso grabado. Puras: sin base ni red.
 */

/**
 * Suma meses de calendario. Si el día no existe en el mes de destino (31 de enero + 1 mes),
 * cae en el último día de ese mes en vez de desbordar a marzo.
 *
 * Menos de un mes no tiene sentido: un acceso que vence al comprarlo es plata cobrada por nada.
 */
export function calcularVencimiento(desde: Date, meses: number): Date {
  const cantidad = Number.isFinite(meses) ? Math.max(1, Math.floor(meses)) : 1;
  const resultado = new Date(desde.getTime());
  const dia = resultado.getUTCDate();
  resultado.setUTCDate(1);
  resultado.setUTCMonth(resultado.getUTCMonth() + cantidad);
  const ultimoDia = new Date(
    Date.UTC(resultado.getUTCFullYear(), resultado.getUTCMonth() + 1, 0),
  ).getUTCDate();
  resultado.setUTCDate(Math.min(dia, ultimoDia));
  return resultado;
}

/** Corto para que entre en la marca de agua, y suficiente para encontrar la inscripción. */
export function numeroDeInscripcion(enrollmentId: string): string {
  return enrollmentId.slice(-6).toUpperCase();
}

const FECHA_ARGENTINA = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function fechaLegibleArgentina(fecha: Date): string {
  return FECHA_ARGENTINA.format(fecha);
}

export type OrigenAcceso = "PURCHASE" | "MEMBER_BENEFIT";
export type EstadoAccesoAlCurso = "VIGENTE" | "VENCIDO" | "REVOCADO" | "SIN_SOCIO";

/**
 * Si una persona puede ver un curso ahora.
 *
 * Lo comprado vale hasta su vencimiento, sea socio o no: lo pagó. Lo tomado gratis por ser
 * socio vale mientras siga siendo socio activo, sin fecha: si queda suspendido o se da de baja
 * deja de verse, y vuelve con su avance al reactivarse (spec §4).
 */
export function estadoDeAccesoAlCurso(
  acceso: { origin: OrigenAcceso; expiresAt: Date | null; revokedAt: Date | null },
  contexto: { esSocioActivo: boolean },
  ahora: Date,
): EstadoAccesoAlCurso {
  if (acceso.revokedAt) return "REVOCADO";
  if (acceso.origin === "MEMBER_BENEFIT") return contexto.esSocioActivo ? "VIGENTE" : "SIN_SOCIO";
  // Una compra siempre nace con vencimiento. Si faltara, no se le quita el curso a quien pagó.
  if (!acceso.expiresAt) return "VIGENTE";
  return ahora.getTime() < acceso.expiresAt.getTime() ? "VIGENTE" : "VENCIDO";
}
