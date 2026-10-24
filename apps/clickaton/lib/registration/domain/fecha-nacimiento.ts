/**
 * Fecha de nacimiento: obligatoria para inscribirse.
 *
 * Hasta el 25/09/2026 nadie la pedía, y el formulario la empezó a exigir sólo del lado del
 * navegador: una inscripción armada a mano o un canje de regalo podían seguir llegando sin ella.
 * Esta es la regla única que usan el servidor, el canje y "Mi cuenta".
 *
 * Se recibe como "YYYY-MM-DD" (lo que manda un `<input type="date">`) y se guarda como
 * medianoche UTC de ese día: la fecha es la parte UTC, nunca se convierte de zona.
 */

export type FechaNacimientoResultado =
  | { ok: true; fecha: Date; iso: string }
  | { ok: false; error: string };

export const EDAD_MINIMA = 5;
export const EDAD_MAXIMA = 110;

export function validarFechaNacimiento(
  raw: string | null | undefined,
  ahora: Date = new Date(),
): FechaNacimientoResultado {
  const texto = (raw ?? "").trim();
  if (!texto) return { ok: false, error: "Ingresá tu fecha de nacimiento." };
  const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { ok: false, error: "Revisá la fecha de nacimiento." };
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  // Date.UTC acepta el 31 de febrero y lo pasa a marzo: eso es una fecha que no existe.
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
    return { ok: false, error: "Esa fecha de nacimiento no existe." };
  }
  const anioActual = ahora.getUTCFullYear();
  if (anio < anioActual - EDAD_MAXIMA || anio > anioActual - EDAD_MINIMA) {
    return { ok: false, error: "Revisá la fecha de nacimiento." };
  }
  return { ok: true, fecha, iso: texto };
}
