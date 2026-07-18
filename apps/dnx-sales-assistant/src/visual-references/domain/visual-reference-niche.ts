/** Reutiliza el catálogo de nichos de la Etapa 14/15 (fuente de verdad). */
import type { VisualNiche } from "../../evaluation/visual-reference/visual-reference-intent.js";

export type VisualReferenceNiche = VisualNiche;
export type { VisualNiche };

export const VISUAL_REFERENCE_NICHES: readonly VisualNiche[] = [
  "bodas",
  "cumpleaños de quince",
  "eventos sociales",
  "fotografía deportiva",
  "fotografía escolar",
  "recitales",
  "retratos",
  "familia",
  "producto",
  "gastronomía",
  "inmobiliaria",
  "corporativa",
] as const;

export function isVisualReferenceNiche(value: string): value is VisualNiche {
  return (VISUAL_REFERENCE_NICHES as readonly string[]).includes(value);
}
