/**
 * La presentación de XV que el bot manda en la primera respuesta a quien llega de un anuncio de XV
 * (19/11/2026: las consultas que sólo recibían "¿Para qué fecha es la fiesta?" no contestaban).
 * Módulo PURO: el precio lo calcula `./presentacion-xv-servidor.ts` con la propuesta modelo.
 */

/** El portfolio y los paquetes de XV de DNX Estudio (el mismo que manda el equipo a mano). */
export const ENLACE_PORTFOLIO_XV = "https://www.compramelafoto.com/dnx/xv";

/** Categorías de consulta que son fiestas de XV ("XV años", "15 años", "Fiesta de 15", "Quinceañera"…). */
const CATEGORIA_XV = /(^|[^a-z0-9])(xv|quince\S*|15)([^a-z0-9]|$)/i;

export function esCategoriaXv(nombre: string): boolean {
  return CATEGORIA_XV.test(nombre);
}

/**
 * El "desde": el menor total (en pesos) entre las opciones de la propuesta. Sólo cuenta totales
 * positivos y se redondea a pesos enteros. null si no hay ninguno (entonces no se dice precio).
 */
export function precioDesde(totales: readonly number[]): number | null {
  const validos = totales.filter((t) => Number.isFinite(t) && t > 0).map((t) => Math.round(t));
  return validos.length > 0 ? Math.min(...validos) : null;
}

/** "$450.000": pesos enteros con punto de miles, como pide la guía. */
export function pesosConPunto(n: number): string {
  return `$${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

/** Lo que devuelve la herramienta `presentacion_xv`. Sin precio respaldado, lo dice y no da ninguno. */
export function textoPresentacionXv(desde: number | null): string {
  return [
    `Portfolio y paquetes de XV: ${ENLACE_PORTFOLIO_XV}`,
    desde !== null
      ? `Precio orientativo: la cobertura de la fiesta arranca desde ${pesosConPunto(desde)} (es la opción más simple de la propuesta del estudio; el precio final sale en la cotización).`
      : "No hay un precio orientativo cargado: no digas ningún precio, sólo pasá el enlace.",
  ].join("\n");
}
