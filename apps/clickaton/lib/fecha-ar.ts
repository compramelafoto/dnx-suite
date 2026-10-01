/**
 * Toda hora que Clickatón muestra es hora de Argentina.
 *
 * `Intl.DateTimeFormat` sin `timeZone` usa el huso del runtime. En Vercel ese
 * huso es UTC, así que una pantalla renderizada en el servidor mostraba las
 * horas 3 horas adelantadas: una inscripción de las 23:07 del 21 aparecía como
 * "22/9/26, 2:07 a. m.". En el navegador salía bien sólo por casualidad, porque
 * quien mira está en Argentina; desde otro país volvía a mentir.
 *
 * Por eso la zona nunca se deja librada al runtime: o es la de la edición, o es
 * la de Argentina. Estos helpers son la única forma de formatear fechas para
 * pantalla; `lib/admin/datetime-input.ts` resuelve el otro lado, el de los
 * formularios que escriben horas.
 */

/** Operaciones Clickatón: -03:00 todo el año, sin horario de verano. */
export const ZONA_ARGENTINA = "America/Argentina/Buenos_Aires";

/**
 * Una zona guardada mal escrita no debe tumbar la pantalla: se cae a Argentina.
 * El resultado se memoriza porque `Intl` se construye en cada conversión.
 */
const zonasValidadas = new Map<string, string>();

export function zonaSegura(zona: string | null | undefined): string {
  const candidata = zona?.trim();
  if (!candidata) return ZONA_ARGENTINA;
  const memorizada = zonasValidadas.get(candidata);
  if (memorizada) return memorizada;
  let resuelta = ZONA_ARGENTINA;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidata });
    resuelta = candidata;
  } catch {
    resuelta = ZONA_ARGENTINA;
  }
  zonasValidadas.set(candidata, resuelta);
  return resuelta;
}

type Entrada = Date | string | number | null | undefined;

/**
 * Formatea una **hora de pared** (`AAAA-MM-DDTHH:mm`, sin zona) sin moverla.
 *
 * La usa el cronograma, que trabaja con horas de pared de la edición y no con
 * instantes: ahí el reloj no tiene que convertir nada, sólo escribir lo que ya
 * dice el texto. Internamente se apoya en UTC porque es el único huso que no
 * corre las horas.
 */
export function formatearHoraDePared(
  valorDePared: string | number,
  opciones: Omit<Intl.DateTimeFormatOptions, "timeZone">,
  ausente = "—",
): string {
  const instante =
    typeof valorDePared === "number"
      ? new Date(valorDePared)
      : new Date(`${valorDePared.replace(" ", "T").slice(0, 16)}:00.000Z`);
  if (Number.isNaN(instante.getTime())) return ausente;
  return new Intl.DateTimeFormat("es-AR", { ...opciones, timeZone: "UTC" }).format(instante);
}

function aInstante(value: Entrada): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formatea en es-AR con la zona forzada. `zona` acepta la de la edición; si
 * viene vacía o inválida, se usa la de Argentina.
 */
export function formatearEnAr(
  value: Entrada,
  opciones: Omit<Intl.DateTimeFormatOptions, "timeZone">,
  zona?: string | null,
  ausente = "—",
): string {
  const instante = aInstante(value);
  if (!instante) return ausente;
  return new Intl.DateTimeFormat("es-AR", {
    ...opciones,
    timeZone: zonaSegura(zona),
  }).format(instante);
}

/**
 * Fecha y hora cortas: `21/9/26, 23:07`.
 *
 * Reloj de 24 horas a propósito: `timeStyle: "short"` en es-AR devuelve
 * "11:07 p. m.", y ese "p. m." chico se lee mal de un vistazo.
 */
export function fechaHoraAr(value: Entrada, zona?: string | null, ausente = "—"): string {
  return formatearEnAr(
    value,
    {
      day: "numeric",
      month: "numeric",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    },
    zona,
    ausente,
  );
}

/** Fecha y hora largas: `21 de septiembre de 2026, 23:07`. */
export function fechaHoraLargaAr(value: Entrada, zona?: string | null, ausente = "—"): string {
  return formatearEnAr(
    value,
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    },
    zona,
    ausente,
  );
}

/** Sólo la fecha: `21/09/2026`. */
export function fechaAr(value: Entrada, zona?: string | null, ausente = "—"): string {
  return formatearEnAr(
    value,
    { day: "2-digit", month: "2-digit", year: "numeric" },
    zona,
    ausente,
  );
}

/** Sólo la hora, en reloj de 24: `23:07`. */
export function horaAr(value: Entrada, zona?: string | null, ausente = "—"): string {
  return formatearEnAr(
    value,
    { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
    zona,
    ausente,
  );
}
