import type { TemplateResolution } from "./types";

/**
 * Resolución de plantilla final para un ítem canjeable (pre-venta escolar).
 * Equivalente: resolveDesignTemplateForRedeemItem (legacy).
 */
export function resolveDesignTemplateForRedeemItem(input: {
  requiresDesign: boolean;
  defaultTemplateId: number | null;
  productTemplateIds: number[];
}): TemplateResolution {
  if (!input.requiresDesign) {
    return { outcome: "NONE_NO_DESIGN" };
  }

  const unique = [...new Set(input.productTemplateIds)];

  if (input.defaultTemplateId != null) {
    if (!unique.includes(input.defaultTemplateId)) {
      return {
        outcome: "NONE_REQUIRED_MISSING",
        reason: "defaultTemplateId no está entre las plantillas del producto",
      };
    }
    return { outcome: "ALBUM_PRODUCT_DEFAULT", templateId: input.defaultTemplateId };
  }

  if (unique.length === 0) {
    return { outcome: "PACK_REQUIRED" };
  }

  if (unique.length > 1) {
    return { outcome: "AMBIGUOUS", candidateTemplateIds: unique };
  }

  return { outcome: "ALBUM_PRODUCT_DEFAULT", templateId: unique[0]! };
}
