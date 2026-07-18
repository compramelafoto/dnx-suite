import type { VisualReference } from "../domain/visual-reference.js";

export type VisualReferenceCatalog = {
  version: number;
  updatedAt?: string;
  references: VisualReference[];
};

export const EMPTY_VISUAL_REFERENCE_CATALOG: VisualReferenceCatalog = {
  version: 1,
  references: [],
};
