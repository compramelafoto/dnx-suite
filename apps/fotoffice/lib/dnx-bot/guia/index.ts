import { seccionPantallas } from "../rutas";
import { IDENTIDAD } from "./identidad";

/**
 * Guía fija de DNX Bot en FOTOFFICE (identidad + reglas + pantallas). Es lo que se cachea en el
 * prompt: el mismo texto en cada llamada, sin fechas ni datos de nadie (eso va en la situación).
 */
export function guiaDelBot(): string {
  return `${IDENTIDAD}\n\n${seccionPantallas()}`;
}
