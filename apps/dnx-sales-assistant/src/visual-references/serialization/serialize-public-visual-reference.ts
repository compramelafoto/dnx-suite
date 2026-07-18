import type { VisualReference } from "../domain/visual-reference.js";

/**
 * Vista segura para el laboratorio: sin rutas absolutas ni paths internos.
 */
export type PublicVisualReference = {
  id: string;
  title: string;
  description: string;
  niches: string[];
  orientation: string;
  educationalPurpose: string[];
  tags: string[];
  authorName?: string;
  attributionRequired: boolean;
  attributionText?: string;
  authorizationBasis: string;
  status: string;
  assetUrl: string;
  thumbnailUrl?: string;
};

export function serializePublicVisualReference(
  ref: VisualReference,
): PublicVisualReference {
  return {
    id: ref.id,
    title: ref.title,
    description: ref.description,
    niches: [...ref.niches],
    orientation: ref.orientation,
    educationalPurpose: [...ref.educationalPurpose],
    tags: [...ref.tags],
    authorName: ref.rights.authorName,
    attributionRequired: ref.rights.attributionRequired,
    attributionText: ref.rights.attributionText,
    authorizationBasis: ref.rights.authorizationBasis,
    status: ref.status,
    assetUrl: `/review-lab/assets/visual-references/${encodeURIComponent(ref.id)}`,
    thumbnailUrl: ref.thumbnailPath
      ? `/review-lab/assets/visual-references/${encodeURIComponent(ref.id)}`
      : undefined,
  };
}
