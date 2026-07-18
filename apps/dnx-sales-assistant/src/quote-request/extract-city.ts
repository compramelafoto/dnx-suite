import { matchKnownCity } from "./cities.js";

export function extractCity(normalizedText: string): string | undefined {
  return matchKnownCity(normalizedText);
}
