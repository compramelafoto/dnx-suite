/** Fechas de la BOX mensual, en hora argentina: `5 nov 2026`. */
export function fechaBox(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
}

/** Cuántos días pasaron desde una fecha, en palabras: «hoy», «hace 1 día», «hace 12 días». */
export function haceDias(desde: Date, now: Date): string {
  const dias = Math.max(0, Math.floor((now.getTime() - desde.getTime()) / 86_400_000));
  if (dias === 0) return "hoy";
  return dias === 1 ? "hace 1 día" : `hace ${dias} días`;
}
