import { ALTO, Armador, PLIEGUE, SEGURIDAD, TUBO_PLIEGUE, type Estilo, type OpcionesMosaico } from "../lienzo";

/**
 * Piezas comunes de las carpetas del curso con mosaico (modelos 51 a 70, serie «mosaicos»).
 *
 * Una carpeta es un librito de 30×20 cm: la tapa lleva el retrato grande del alumno, la
 * contratapa la foto grupal y la maestra, y adentro va el mosaico de compañeros partido en las dos
 * páginas. Los dos recuadros del mosaico son del mismo tamaño y se reparten parejo (13 y 12 de 25),
 * así los retratos salen iguales en las dos mitades.
 */

/** Margen del mosaico contra el corte y contra el doblez (lo mínimo que piden las reglas, con aire). */
const MARGEN_CORTE = SEGURIDAD + 70;
const MARGEN_DOBLEZ = TUBO_PLIEGUE + 60;

/** El ancho de cada recuadro del mosaico, igual en las dos mitades. */
export const ANCHO_MOSAICO = PLIEGUE - MARGEN_CORTE - MARGEN_DOBLEZ;

/**
 * El mosaico partido en las dos páginas del interior: el recuadro 1 a la izquierda y el 2 a la
 * derecha, de `y` a `y + alto`. Devuelve los dos rectángulos por si el modelo quiere dibujarles
 * algo detrás.
 */
export function mosaicoEnDosPaginas(
  a: Armador,
  y: number,
  alto: number,
  nombres: Estilo,
  opciones: OpcionesMosaico,
) {
  const izq = { x: MARGEN_CORTE, y, w: ANCHO_MOSAICO, h: alto };
  const der = { x: PLIEGUE + MARGEN_DOBLEZ, y, w: ANCHO_MOSAICO, h: alto };
  a.mosaico(1, "mosaico_1", izq, nombres, { ...opciones, chainOrder: 1, capacity: 0 });
  a.mosaico(1, "mosaico_2", der, nombres, { ...opciones, chainOrder: 2, capacity: 0 });
  return { izq, der };
}

/** Lo que dice cada carpeta sobre las fotos que se le piden a la familia. */
export const ETIQUETAS_MOSAICO = {
  individual: "Foto del alumno (va grande en la tapa)",
  grupal: "Foto grupal del curso",
  maestra: "Foto de la seño o del profe",
} as const;

/** Lo que agregan todas las carpetas a su descripción. */
export const DESCRIPCION_MOSAICO =
  "Adentro, el mosaico con todos los compañeros del curso (cada uno con su retrato y su nombre) repartido en las dos páginas; el alumno dueño de la carpeta no aparece en su propio mosaico.";

/** Para que el alto de un bloque no pase el margen de abajo. */
export const ABAJO = ALTO - MARGEN_CORTE;
