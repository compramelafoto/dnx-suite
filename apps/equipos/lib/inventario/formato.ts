const TZ = "America/Argentina/Buenos_Aires";

/** Fecha y hora en horario de Argentina. */
export function fechaHoraAr(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

/** Sólo la fecha, en horario de Argentina. */
export function fechaAr(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: TZ, dateStyle: "short" }).format(d);
}

/** yyyy-mm-dd para un <input type="date">, según el día calendario de Argentina. */
export function fechaInput(d: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export const EVENT_LABELS: Record<string, string> = {
  CREATED: "Equipo agregado",
  CONFIRMED_FROM_CLF: "Confirmado desde CompraMeLaFoto",
  UPDATED: "Datos actualizados",
  STATUS_CHANGED: "Cambio de estado",
  REPORTED: "Denuncia registrada",
  RECOVERED: "Marcado como recuperado",
  PROOF_ADDED: "Comprobante de compra agregado",
};
