/**
 * Cuánto hace, en palabras.
 *
 * Una fecha con segundos obliga a hacer la cuenta mentalmente. La exacta se
 * conserva para el `title`, que es donde sirve.
 */
const FORMATO = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

export function tiempoRelativo(fecha: Date | null | undefined, ahora: Date = new Date()): string {
  if (!fecha) return "sin actividad";

  const diferencia = fecha.getTime() - ahora.getTime();
  const absoluta = Math.abs(diferencia);
  const signo = diferencia < 0 ? -1 : 1;

  if (absoluta < MINUTO) return "recién";
  if (absoluta < HORA) return FORMATO.format(signo * Math.round(absoluta / MINUTO), "minute");
  if (absoluta < DIA) return FORMATO.format(signo * Math.round(absoluta / HORA), "hour");

  const dias = Math.round(absoluta / DIA);
  if (dias < 30) return FORMATO.format(signo * dias, "day");

  // Meses y años se redondean HACIA ABAJO: 45 días es "hace 1 mes", no "hace
  // 2 meses". Exagerar el tiempo transcurrido hace parecer más abandonado de
  // lo que está.
  if (dias < 365) return FORMATO.format(signo * Math.max(1, Math.floor(dias / 30)), "month");
  return FORMATO.format(signo * Math.max(1, Math.floor(dias / 365)), "year");
}

/** Para el `title`: la fecha completa, cuando de verdad hace falta. */
export function fechaExacta(fecha: Date | null | undefined): string {
  if (!fecha) return "";
  return fecha.toLocaleString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
