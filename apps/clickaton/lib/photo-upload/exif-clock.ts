/**
 * La hora del EXIF es la hora del reloj de la cámara, sin zona horaria.
 *
 * `exifr` entrega esos números como si fueran UTC. En Argentina (UTC−3) eso
 * corre toda fotografía tres horas hacia atrás: una captura de las 16:25 llega
 * como 16:25 UTC, que son las 13:25 de acá, y cae fuera de la ventana de la
 * consigna aunque se haya tomado en hora.
 *
 * Acá se reinterpreta: se toman los números del reloj y se los ubica en la zona
 * horaria de la edición, o en el desfasaje que venga declarado en el propio
 * EXIF cuando la cámara lo guardó (`OffsetTimeOriginal`).
 */

/** Minutos al este de UTC de una zona horaria en un instante dado (AR = −180). */
export function offsetMinutesForZone(instant: Date, timeZone: string): number {
  try {
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(instant);

    const campo = (tipo: string) =>
      Number(partes.find((p) => p.type === tipo)?.value ?? "0");

    const hora = campo("hour") % 24; // algunos entornos devuelven "24" a medianoche
    const comoUtc = Date.UTC(
      campo("year"),
      campo("month") - 1,
      campo("day"),
      hora,
      campo("minute"),
      campo("second"),
    );
    return Math.round((comoUtc - instant.getTime()) / 60_000);
  } catch {
    // Zona desconocida: sin corrección, mejor que romper la carga.
    return 0;
  }
}

/** "−03:00" / "+0530" / "Z" → minutos al este de UTC. */
export function parseExifOffset(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const texto = raw.trim().replace(/[−‒–—]/g, "-");
  if (/^Z$/i.test(texto)) return 0;
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(texto);
  if (!m) return null;
  const signo = m[1] === "-" ? -1 : 1;
  const horas = Number(m[2]);
  const minutos = Number(m[3]);
  if (horas > 14 || minutos > 59) return null;
  return signo * (horas * 60 + minutos);
}

/**
 * Convierte la lectura cruda del EXIF en el instante real de la captura.
 *
 * `exifDate` viene con los números del reloj puestos en UTC; se los reubica en
 * la zona correcta. Se resuelve en dos pasadas para no equivocar el resultado
 * en los bordes de cambio de horario.
 */
export function interpretExifClock(input: {
  exifDate: Date | null;
  timeZone: string;
  exifOffsetMinutes?: number | null;
}): Date | null {
  if (!input.exifDate || Number.isNaN(input.exifDate.getTime())) return null;

  if (input.exifOffsetMinutes != null) {
    return new Date(input.exifDate.getTime() - input.exifOffsetMinutes * 60_000);
  }

  const primera = new Date(
    input.exifDate.getTime() -
      offsetMinutesForZone(input.exifDate, input.timeZone) * 60_000,
  );
  return new Date(
    input.exifDate.getTime() -
      offsetMinutesForZone(primera, input.timeZone) * 60_000,
  );
}
