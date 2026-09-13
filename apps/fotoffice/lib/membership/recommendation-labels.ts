/**
 * Cómo se le nombra al socio el premio por recomendar.
 *
 * Está acá y no escrito en cada pantalla porque el mismo beneficio se anuncia en dos lugares
 * —la portada del portal y la pantalla de recomendados— y la institución puede cambiar el
 * porcentaje cuando quiera. Dos textos sueltos se separan: uno prometería una cuota entera
 * mientras el otro ofrece la mitad.
 */

/**
 * El beneficio en palabras, para completar una frase: «ganás …».
 *
 * 100% o más es una cuota completa: nadie dice "un 100% de descuento". Por debajo de eso se
 * nombra el porcentaje, que es lo que la Secretaría configuró.
 */
export function recommendationBenefitPhrase(percent: number): string {
  return percent >= 100
    ? "una cuota completa sin cargo"
    : `un ${percent}% de descuento en una cuota`;
}
