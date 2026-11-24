import { textoCurso } from "@/lib/schools/embudo-pedidos-escolares";

/**
 * Grupal por curso: la primera foto grupal que elige el fotógrafo para un curso queda guardada
 * (`SchoolCourseGroupPhoto`) y aparece ya puesta en los pedidos siguientes del mismo curso.
 */

/** Clave estable del curso: "5° A" y " 5°  a " son el mismo. `null` si no hay curso. */
export function claveDeCurso(curso: { name: string; division: string | null } | null | undefined): string | null {
  const texto = textoCurso(curso);
  if (!texto) return null;
  return texto.replace(/\s+/g, " ").trim().toLowerCase();
}

/** La foto a guardar: la del lugar grupal, sólo si está entre las fotos del canje. */
export function grupalParaGuardar(grupalElegida: number | undefined, fotosDelCanje: number[]): number | null {
  if (grupalElegida == null) return null;
  return fotosDelCanje.includes(grupalElegida) ? grupalElegida : null;
}
