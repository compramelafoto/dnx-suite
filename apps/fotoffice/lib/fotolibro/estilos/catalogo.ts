import { TEMAS, type EstiloFotolibro, type TemaId } from "./tipos";
import { BODAS } from "./temas/bodas";

/** Todos los estilos de fotolibro, por temática. */
export const ESTILOS: readonly EstiloFotolibro[] = [...BODAS];

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
