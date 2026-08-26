/**
 * Conversión de importes entre lo que guarda la base y lo que usa el cálculo.
 *
 * La base guarda `Decimal(12,2)`; el cálculo trabaja en centavos enteros. La conversión pasa
 * por el **texto**, no por `Number`: `0.1 + 0.2` en punto flotante da `0.30000000000000004`,
 * y un peso mal redondeado en una cuota se convierte en una discusión con el socio.
 */

export function decimalArsToMinor(value: { toString(): string }): number {
  const texto = value.toString();
  const [entera = "0", decimal = ""] = texto.split(".");
  // Se recorta a dos decimales sin redondear: tomar por exceso inventaría plata que nadie debe.
  const centavos = `${decimal}00`.slice(0, 2);
  const negativo = entera.startsWith("-");
  const enteraAbs = entera.replace("-", "");
  const minor = Number(enteraAbs) * 100 + Number(centavos);
  return negativo ? -minor : minor;
}

/** Centavos a texto con dos decimales, para guardar en un `Decimal`. */
export function minorToDecimalString(minor: number): string {
  const negativo = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const entera = Math.floor(abs / 100);
  const centavos = String(abs % 100).padStart(2, "0");
  return `${negativo ? "-" : ""}${entera}.${centavos}`;
}

/** Para mostrarle un importe a una persona. */
export function formatMinorArs(minor: number): string {
  const negativo = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const entera = Math.floor(abs / 100);
  const centavos = String(abs % 100).padStart(2, "0");
  const miles = String(entera).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negativo ? "-" : ""}$ ${miles},${centavos}`;
}
