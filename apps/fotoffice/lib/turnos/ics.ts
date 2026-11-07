/** Archivo de calendario (.ics) para "Agregar a mi calendario". Módulo PURO. */

function fechaIcs(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapar(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function armarIcs(e: {
  uid: string;
  inicio: Date;
  fin: Date;
  titulo: string;
  descripcion?: string | null;
  lugar?: string | null;
  ahora: Date;
  /** CANCEL para avisar que se canceló. */
  metodo?: "PUBLISH" | "CANCEL";
  secuencia?: number;
}): string {
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FOTOFFICE//Turnos//ES",
    "CALSCALE:GREGORIAN",
    `METHOD:${e.metodo ?? "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `SEQUENCE:${e.secuencia ?? 0}`,
    `DTSTAMP:${fechaIcs(e.ahora)}`,
    `DTSTART:${fechaIcs(e.inicio)}`,
    `DTEND:${fechaIcs(e.fin)}`,
    `SUMMARY:${escapar(e.titulo)}`,
    ...(e.descripcion ? [`DESCRIPTION:${escapar(e.descripcion)}`] : []),
    ...(e.lugar ? [`LOCATION:${escapar(e.lugar)}`] : []),
    ...(e.metodo === "CANCEL" ? ["STATUS:CANCELLED"] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lineas.join("\r\n") + "\r\n";
}
