/**
 * Cómo se pone una nota según su escala.
 *
 * El visor nació para cuatro criterios del 1 al 10: diez botones por criterio
 * y las teclas del 1 al 9 más el 0 para el 10. Con los demás tipos de
 * calificación eso no alcanza: un sí o no no son números, y del 0 al 100 serían
 * ciento un botones. Esta regla la comparten la computadora, el teléfono y la
 * ayuda, para que no puedan decir cosas distintas.
 */

export type FormaDeLaNota = "SI_NO" | "BOTONES" | "CAMPO";

export type Escala = { min: number; max: number };

/** Con más de once valores los botones dejan de caber: se escribe el número. */
const MAXIMO_DE_BOTONES = 11;

export function formaDeLaNota(e: Escala): FormaDeLaNota {
  if (e.min === 0 && e.max === 1) return "SI_NO";
  return e.max - e.min + 1 <= MAXIMO_DE_BOTONES ? "BOTONES" : "CAMPO";
}

/** Lo que se muestra en el botón o al lado de la nota puesta. */
export function textoDeLaNota(e: Escala, valor: number): string {
  if (formaDeLaNota(e) === "SI_NO") return valor === 1 ? "Sí" : "No";
  return String(valor);
}

/**
 * Qué nota pone una tecla, o `null` si esa tecla no pone ninguna.
 *
 * - Sí o no: S o 1 es sí; N o 0 es no.
 * - Botones: el número; en una escala hasta 10, el 0 vale 10.
 * - Campo: no se resuelve de a una tecla (ver `acumularDigito`).
 */
export function notaPorTecla(e: Escala, tecla: string): number | null {
  const forma = formaDeLaNota(e);
  if (forma === "SI_NO") {
    if (tecla === "s" || tecla === "S" || tecla === "1") return 1;
    if (tecla === "n" || tecla === "N" || tecla === "0") return 0;
    return null;
  }
  if (forma === "BOTONES" && /^[0-9]$/.test(tecla)) {
    const n = tecla === "0" && e.max === 10 ? 10 : Number(tecla);
    return n >= e.min && n <= e.max ? n : null;
  }
  return null;
}

/**
 * Para las escalas largas (0 a 100): los dígitos tecleados seguidos forman un
 * número. "7" y enseguida "5" es 75. Si el número se pasa del máximo, empieza
 * de nuevo con el último dígito.
 */
export function acumularDigito(e: Escala, previo: string, digito: string): { texto: string; valor: number | null } {
  let texto = `${previo}${digito}`.replace(/^0+(?=\d)/, "");
  if (Number(texto) > e.max) texto = digito;
  const valor = Number(texto);
  return { texto, valor: valor >= e.min && valor <= e.max ? valor : null };
}

/** Cómo se explica la escala en una línea de ayuda. */
export function ayudaDeTeclas(e: Escala): string {
  switch (formaDeLaNota(e)) {
    case "SI_NO":
      return "S sí · N no";
    case "BOTONES":
      return e.max === 10 ? `${e.min}-9 · 0 = 10` : `${e.min}-${e.max}`;
    case "CAMPO":
      return `escribí del ${e.min} al ${e.max}`;
  }
}
