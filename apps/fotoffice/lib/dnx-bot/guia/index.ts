import { seccionPantallas } from "../rutas";
import { IDENTIDAD } from "./identidad";
import { GUIA_PERFIL } from "./perfil";

/**
 * Guía fija de DNX Bot en FOTOFFICE (identidad + reglas + etapa 1 + pantallas). Es lo que se cachea en el
 * prompt: el mismo texto en cada llamada, sin fechas ni datos de nadie (eso va en la situación).
 */
export function guiaDelBot(): string {
  return `${IDENTIDAD}\n\n${GUIA_PERFIL}\n\n${seccionPantallas()}`;
}
