import { seccionPantallas } from "../rutas";
import { IDENTIDAD } from "./identidad";
import { GUIA_PERFIL } from "./perfil";
import { GUIA_COTIZAR } from "./cotizar";
import { GUIA_CONSULTAS } from "./consultas";

/**
 * Guía fija de DNX Bot en FOTOFFICE (identidad + reglas + etapas 1 a 3 + pantallas). Es lo que se cachea en el
 * prompt: el mismo texto en cada llamada, sin fechas ni datos de nadie (eso va en la situación).
 */
export function guiaDelBot(): string {
  return `${IDENTIDAD}\n\n${GUIA_PERFIL}\n\n${GUIA_COTIZAR}\n\n${GUIA_CONSULTAS}\n\n${seccionPantallas()}`;
}
