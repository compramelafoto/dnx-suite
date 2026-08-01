/** Precio grande para cards de experiencia (solo UI). */
export function formatExperiencePrice(minor: number): string {
  const pesos = Math.round(minor / 100);
  return `$ ${pesos.toLocaleString("es-AR")}`;
}
