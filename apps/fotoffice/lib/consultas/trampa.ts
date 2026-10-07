/**
 * Campo trampa de los formularios públicos de consultas: invisible para las personas (fuera de
 * pantalla, `aria-hidden`, sin tabulación ni autocompletado), sólo lo llenan los robots. Si llega
 * con algo, el servidor responde lo mismo que con éxito y no crea nada.
 */
export const CAMPO_TRAMPA = "website2";

/** ¿La trampa vino llena? */
export function cayoEnLaTrampa(valor: unknown): boolean {
  return typeof valor === "string" && valor.trim() !== "";
}
