import { palabras } from "./copia";

/**
 * Para no repetir temas: además de no repetir la dirección de la noticia, el Periodista no tiene
 * que proponer el MISMO HECHO contado por otro medio (pasó con "World Press Photo en Barcelona").
 * Se compara el `tema` corto que devuelve Claude (y el título) contra los temas recientes, por sus
 * palabras clave. Módulo PURO.
 */

/** Días hacia atrás cuyos temas se le pasan a Claude para que no los repita. */
export const DIAS_TEMAS_A_EVITAR = 45;
/** Desde cuánta coincidencia de palabras clave dos temas son "el mismo". */
export const UMBRAL_TEMA_PARECIDO = 0.6;
/** Mínimo de palabras clave en común para considerarlos el mismo (una sola nunca alcanza). */
const MIN_EN_COMUN = 2;

/**
 * Palabras que no distinguen un tema de otro: artículos, preposiciones (castellano e inglés) y
 * las genéricas del rubro ("fotografía", "concurso", "2026"...), que aparecen en casi todos.
 */
const VACIAS = new Set(
  `a al ante bajo con contra de del desde durante e el en entre hacia hasta la las lo los mas
  para por segun sin sobre su sus tras un una unas unos y o u que se es son fue ya como muy mas
  nuevo nueva nuevos nuevas llega llegan presenta presentan anuncia lanza abre edicion
  the of and in on at to for from with by an is are its new how why what
  foto fotos fotografia fotografias fotografo fotografos fotografa fotografas fotografico fotografica
  photo photos photography photographer photographers
  concurso concursos premio premios muestra muestras exposicion exposiciones
  argentina argentino argentinos ano anos dia dias`
    .split(/\s+/)
    .filter(Boolean),
);

/**
 * Las palabras clave de un texto: normalizadas, sin vacías, sin años sueltos ni palabras de 1-2
 * letras (salvo modelos como "A7" o "Z9", que llevan número).
 */
export function palabrasClave(texto: string | null | undefined): Set<string> {
  const salida = new Set<string>();
  for (const p of palabras(texto ?? "")) {
    if (p.length < 2 || (p.length < 3 && !/\d/.test(p)) || VACIAS.has(p) || /^(19|20)\d\d$/.test(p)) continue;
    salida.add(p);
  }
  return salida;
}

/**
 * Cuánto se parecen dos temas, de 0 a 1: la parte de las palabras clave del más corto que está
 * en el otro. 0 si comparten menos de 2.
 */
export function similitudDeTemas(a: string | null | undefined, b: string | null | undefined): number {
  const pa = palabrasClave(a);
  const pb = palabrasClave(b);
  if (pa.size === 0 || pb.size === 0) return 0;
  let comunes = 0;
  for (const p of pa) if (pb.has(p)) comunes++;
  if (comunes < MIN_EN_COMUN) return 0;
  return comunes / Math.min(pa.size, pb.size);
}

export type TemaPrevio = {
  tema: string;
  /** Título de la nota o de la fuente (las propuestas viejas no tienen `tema`). */
  titulo?: string | null;
  estado: string;
  /** Si es de hoy (los descartados de hoy van con más énfasis). */
  deHoy: boolean;
};

/** El tema previo que se parece demasiado al nuevo, o null. */
export function temaRepetido(nuevo: { tema: string; titulo?: string | null }, previos: TemaPrevio[]): TemaPrevio | null {
  let peor: { previo: TemaPrevio; valor: number } | null = null;
  for (const previo of previos) {
    const valor = Math.max(
      similitudDeTemas(nuevo.tema, previo.tema),
      similitudDeTemas(nuevo.titulo, previo.titulo),
      similitudDeTemas(nuevo.tema, previo.titulo),
      similitudDeTemas(nuevo.titulo, previo.tema),
    );
    if (valor >= UMBRAL_TEMA_PARECIDO && (!peor || valor > peor.valor)) peor = { previo, valor };
  }
  return peor?.previo ?? null;
}
