/**
 * Qué categoría le corresponde a la escala de cuota que declaró el aspirante.
 *
 * El formulario público pregunta la **condición** —profesional, estudiante, aficionado— y de
 * ahí sale la escala. La categoría, en cambio, es del padrón, y hasta ahora quedaba vacía: los
 * socios nuevos entraban sin ninguna.
 *
 * La correspondencia es por nombre y por convención, porque los nombres de categoría los
 * define cada institución. Si ninguno coincide, no se inventa: se devuelve `null` y la
 * Secretaría la asigna a mano. Asignar una categoría que significa otra cosa sería peor que
 * dejarla vacía.
 *
 * Función pura: la categoría decide cuánto paga cada socio, así que tiene que poder probarse.
 */

export type FeeScale = "PLENA" | "REDUCIDA" | "EXENTA";

/** Nombres esperables para cada escala, en orden de preferencia. */
const NOMBRES: Record<FeeScale, string[]> = {
  PLENA: ["profesional"],
  REDUCIDA: ["estudiante"],
  EXENTA: ["honorario"],
};

const normalizar = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function pickCategoryForScale(
  scale: FeeScale,
  categories: { id: string; name: string }[],
): string | null {
  for (const esperado of NOMBRES[scale] ?? []) {
    const encontrada = categories.find((c) => normalizar(c.name) === esperado);
    if (encontrada) return encontrada.id;
  }
  return null;
}
