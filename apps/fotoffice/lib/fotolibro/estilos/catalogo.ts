import { TEMAS, type EstiloFotolibro, type TemaId } from "./tipos";
import { BODAS } from "./temas/bodas";
import { PAREJA } from "./temas/pareja";
import { XV } from "./temas/xv";
import { INFANTIL } from "./temas/infantil";
import { ADULTOS } from "./temas/adultos";
import { BAUTISMO } from "./temas/bautismo";
import { COMUNION } from "./temas/comunion";
import { BEBES } from "./temas/bebes";
import { EMBARAZO } from "./temas/embarazo";
import { FAMILIA } from "./temas/familia";
import { EGRESADOS } from "./temas/egresados";
import { PLAYA } from "./temas/playa";
import { MONTANA } from "./temas/montana";
import { NIEVE } from "./temas/nieve";
import { EUROPA } from "./temas/europa";
import { EEUU } from "./temas/eeuu";
import { MASCOTAS } from "./temas/mascotas";

/** Todos los estilos de fotolibro, por temática (10 por temática). */
export const ESTILOS: readonly EstiloFotolibro[] = [
  ...BODAS,
  ...PAREJA,
  ...XV,
  ...INFANTIL,
  ...ADULTOS,
  ...BAUTISMO,
  ...COMUNION,
  ...BEBES,
  ...EMBARAZO,
  ...FAMILIA,
  ...EGRESADOS,
  ...PLAYA,
  ...MONTANA,
  ...NIEVE,
  ...EUROPA,
  ...EEUU,
  ...MASCOTAS,
];

export function estiloPorId(id: string | null | undefined): EstiloFotolibro | null {
  return id ? ESTILOS.find((e) => e.id === id) ?? null : null;
}

export function estilosDelTema(tema: TemaId): EstiloFotolibro[] {
  return ESTILOS.filter((e) => e.tema === tema);
}

/** Las temáticas que ya tienen estilos, en el orden del catálogo. */
export function temasConEstilos() {
  return TEMAS.filter((t) => ESTILOS.some((e) => e.tema === t.id));
}
