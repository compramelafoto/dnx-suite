/**
 * Fechas de la Comisión directiva, siempre en hora argentina. Funciones PURAS.
 *
 * Los mandatos se guardan como instantes (inicio a las 00:00 y fin a las 23:59:59 de Buenos
 * Aires, ver `parseTermDates`). Mostrarlos con la zona del servidor —UTC en Vercel— correría el
 * fin de mandato al día siguiente.
 */

const TZ = "America/Argentina/Buenos_Aires";

const dia = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
// en-CA escribe AAAA-MM-DD: justo lo que espera un <input type="date">.
const iso = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** "31/12/2027". */
export function fechaCorta(d: Date): string {
  return dia.format(d);
}

/** Valor para un `<input type="date">`; vacío si no hay fecha. */
export function fechaParaInput(d: Date | null): string {
  return d ? iso.format(d) : "";
}

/** "hasta 31/12/2027", o "sin vencimiento". */
export function textoMandato(endsAt: Date | null): string {
  return endsAt ? `hasta ${fechaCorta(endsAt)}` : "sin vencimiento";
}
