import { foldQuoteText } from "./fold.js";

/** Lista centralizada de ciudades reconocidas (sin geocodificación). */
export const KNOWN_CITIES: readonly { folded: string; display: string }[] = [
  { folded: "cordoba capital", display: "Córdoba Capital" },
  { folded: "villa carlos paz", display: "Villa Carlos Paz" },
  { folded: "rio cuarto", display: "Río Cuarto" },
  { folded: "villa maria", display: "Villa María" },
  { folded: "buenos aires", display: "Buenos Aires" },
  { folded: "bs as", display: "Buenos Aires" },
  { folded: "bsas", display: "Buenos Aires" },
  { folded: "rosario", display: "Rosario" },
  { folded: "funes", display: "Funes" },
  { folded: "santa fe", display: "Santa Fe" },
  { folded: "mendoza", display: "Mendoza" },
  { folded: "cordoba", display: "Córdoba" },
] as const;

export function matchKnownCity(normalizedText: string): string | undefined {
  const folded = foldQuoteText(normalizedText);
  // Más específico primero (ya ordenado: capital antes que córdoba)
  for (const city of KNOWN_CITIES) {
    if (folded.includes(city.folded)) {
      return city.display;
    }
  }
  return undefined;
}
