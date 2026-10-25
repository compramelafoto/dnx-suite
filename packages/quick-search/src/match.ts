import type { QuickSearchEntry } from "./types";

/** Cuántos resultados se muestran como mucho. Más que esto no se lee: se recorre con la vista. */
export const MAX_RESULTS = 10;

/**
 * Minúsculas y sin acentos.
 *
 * Es lo que hace que "cuótas", "Cuotas" y "CUOTAS" encuentren lo mismo. Nadie escribe acentos
 * en un buscador, y quien los escribe no tiene por qué salir perjudicado.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Dónde coincidió el término, en puntos. El orden importa más que los números: lo que se está
 * diciendo es que el título vale más que la sección, y la sección más que la descripción.
 */
const PUNTOS = {
  tituloEmpieza: 100,
  tituloContiene: 60,
  seccion: 40,
  descripcion: 25,
  sinonimo: 20,
} as const;

/** El mejor puntaje de un término contra una entrada. 0 significa que no coincide en ningún lado. */
function puntuarTermino(entry: QuickSearchEntry, termino: string): number {
  const titulo = normalize(entry.label);
  if (titulo.startsWith(termino)) return PUNTOS.tituloEmpieza;
  if (titulo.includes(termino)) return PUNTOS.tituloContiene;
  if (normalize(entry.group).includes(termino)) return PUNTOS.seccion;
  if (entry.description && normalize(entry.description).includes(termino)) {
    return PUNTOS.descripcion;
  }
  if (entry.keywords?.some((k) => normalize(k).includes(termino))) return PUNTOS.sinonimo;
  return 0;
}

/**
 * Palabras que la gente escribe cuando pregunta en vez de buscar ("¿dónde veo las cuotas de un
 * socio?") y que no dicen nada sobre la pantalla. Se descartan antes de buscar.
 */
const PALABRAS_VACIAS = new Set([
  "a", "al", "como", "con", "cual", "cuales", "de", "del", "donde", "el", "en", "es", "esta",
  "este", "hacer", "hago", "la", "las", "lo", "los", "me", "mi", "mis", "o", "para", "por",
  "puedo", "que", "quiero", "se", "su", "sus", "un", "una", "unos", "unas", "veo", "ver", "y",
]);

/**
 * Las palabras de la consulta, normalizadas y sin las vacías.
 *
 * Los plurales se recortan al singular ("socios" → "socio", "reservas" → "reserva") para que
 * busquen también dentro de la forma singular. Solo en palabras largas: "mes" no es "me".
 */
export function queryTerms(query: string): string[] {
  const todas = normalize(query)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const utiles = todas.filter((t) => !PALABRAS_VACIAS.has(t));
  // Si todo era palabra vacía ("de"), se busca igual con lo que hay.
  const base = utiles.length > 0 ? utiles : todas;
  return base.map((t) => {
    if (t.length > 5 && t.endsWith("es")) return t.slice(0, -2);
    if (t.length > 4 && t.endsWith("s")) return t.slice(0, -1);
    return t;
  });
}

/**
 * Las entradas que coinciden con lo que se escribió, de la mejor a la peor.
 *
 * Todo ocurre en el navegador sobre una lista de decenas de elementos: no hay consulta al
 * servidor, no hace falta demora deliberada y se puede recalcular en cada tecla.
 *
 * Con la consulta vacía devuelve el menú entero, sin cortar: abrir la lupa y ver todo lo que
 * existe es la mitad del valor.
 *
 * Primero exige que estén todas las palabras: "res esp" tiene que llegar a Espacios, no traer
 * media lista. Si así no aparece nada —pasa con las frases, donde siempre sobra alguna
 * palabra—, se queda con las entradas que coinciden con más palabras.
 */
export function matchEntries(
  entries: QuickSearchEntry[],
  query: string,
): QuickSearchEntry[] {
  const terminos = queryTerms(query);
  if (terminos.length === 0) return entries;

  const puntuadas = entries.map((entry, orden) => {
    let total = 0;
    let coinciden = 0;
    for (const termino of terminos) {
      const puntaje = puntuarTermino(entry, termino);
      if (puntaje > 0) coinciden += 1;
      total += puntaje;
    }
    return { entry, puntaje: total, coinciden, orden };
  });

  const completas = puntuadas.filter((p) => p.coinciden === terminos.length);
  let elegidas = completas;
  if (elegidas.length === 0 && terminos.length > 1) {
    const mejor = Math.max(0, ...puntuadas.map((p) => p.coinciden));
    elegidas = mejor > 0 ? puntuadas.filter((p) => p.coinciden === mejor) : [];
  }

  return elegidas
    .sort((a, b) => b.puntaje - a.puntaje || a.orden - b.orden)
    .slice(0, MAX_RESULTS)
    .map((p) => p.entry);
}

/**
 * Los resultados agrupados por sección, respetando el orden en que llegaron: la sección del
 * mejor resultado va primero.
 */
export function groupResults(
  entries: QuickSearchEntry[],
): { group: string; entries: QuickSearchEntry[] }[] {
  const grupos = new Map<string, QuickSearchEntry[]>();
  for (const entry of entries) {
    const lista = grupos.get(entry.group);
    if (lista) lista.push(entry);
    else grupos.set(entry.group, [entry]);
  }
  return [...grupos].map(([group, lista]) => ({ group, entries: lista }));
}
