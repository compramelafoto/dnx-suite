import type { EducationalPurpose } from "./educational-purpose.js";
import type { VisualReferenceNiche } from "./visual-reference-niche.js";
import type { VisualReferenceRights } from "./visual-reference-rights.js";
import type { VisualReferenceSource } from "./visual-reference-source.js";

export type VisualReferenceOrientation = "LANDSCAPE" | "PORTRAIT" | "SQUARE";
export type VisualReferenceStatus = "DRAFT" | "APPROVED" | "DISABLED";

export type VisualReference = {
  id: string;
  version: number;
  title: string;
  description: string;
  niches: VisualReferenceNiche[];
  /** Ruta relativa al directorio permitido de assets (nunca absoluta en API). */
  imagePath: string;
  thumbnailPath?: string;
  orientation: VisualReferenceOrientation;
  educationalPurpose: EducationalPurpose[];
  tags: string[];
  source: VisualReferenceSource;
  rights: VisualReferenceRights;
  status: VisualReferenceStatus;
  createdAt: string;
  updatedAt: string;
};
