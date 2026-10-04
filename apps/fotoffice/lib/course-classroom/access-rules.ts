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

export type EstadoAcceso = "VIGENTE" | "VENCIDO" | "REVOCADO";

export function estadoDelAcceso(
  acceso: { expiresAt: Date; revokedAt: Date | null },
  ahora: Date,
): EstadoAcceso {
  if (acceso.revokedAt) return "REVOCADO";
  return ahora.getTime() < acceso.expiresAt.getTime() ? "VIGENTE" : "VENCIDO";
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
