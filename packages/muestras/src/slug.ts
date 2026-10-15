export function slugify(title: string): string {
  const s = title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "actividad";
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8).padEnd(6, "0");
}

/** El sufijo evita choques entre dos muestras con el mismo título (itinerantes, ediciones). */
export function newSlug(title: string, random: () => string = randomSuffix): string {
  return `${slugify(title)}-${random()}`;
}
