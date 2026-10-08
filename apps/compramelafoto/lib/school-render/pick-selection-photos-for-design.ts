/**
 * Qué plantilla arma el diseño de un ítem de preventa, y con qué fotos. Puro (sin base), para
 * poder probarlo.
 */

export type DesignTemplateSource = "PACK_REQUIRED" | "NONE" | "AMBIGUOUS";

export type DesignTemplateResolution = {
  source: DesignTemplateSource;
  /** Plantilla del diseñador nuevo. */
  templateV2Id: string | null;
  /** Beneficios del pack que exigen esta plantilla (vacío si no viene del pack). */
  benefitStableKeys: string[];
  reason?: string;
};

type BenefitForResolution = {
  stableKey: string;
  sortOrder: number;
  templatePolicy: string;
  templateV2Id?: string | null;
};

/**
 * La plantilla sale de los beneficios del pack que la exigen (`templatePolicy = REQUIRED`). Si
 * piden plantillas distintas no se adivina: se marca como ambiguo y el fotógrafo lo ve.
 */
export function resolveDesignTemplateForRedeem(benefits: BenefitForResolution[]): DesignTemplateResolution {
  const required = [...benefits].sort((a, b) => a.sortOrder - b.sortOrder).filter((b) => b.templatePolicy === "REQUIRED");
  if (required.length === 0) {
    return { source: "NONE", templateV2Id: null, benefitStableKeys: [], reason: "no_design_required" };
  }
  const ids = required.map((b) => b.templateV2Id?.trim() || null);
  if (ids.some((id) => !id)) {
    return { source: "NONE", templateV2Id: null, benefitStableKeys: [], reason: "required_template_missing" };
  }
  if (new Set(ids).size !== 1) {
    return { source: "AMBIGUOUS", templateV2Id: null, benefitStableKeys: [], reason: "multiple_required_templates" };
  }
  return { source: "PACK_REQUIRED", templateV2Id: ids[0]!, benefitStableKeys: required.map((b) => b.stableKey) };
}

/**
 * Fotos que van al diseño.
 *
 * Cuando la plantilla la exige un beneficio del pack, solo entran las fotos que la familia eligió
 * PARA ESE beneficio. Si entraran todas, las fotos digitales podrían ocupar los huecos del impreso
 * (se asignan por orden de posición) y la carpeta se imprimiría con las fotos equivocadas.
 *
 * Devuelve lista vacía cuando hay fotos permitidas pero ninguna coincide: es preferible no generar
 * el diseño a generarlo con las fotos que no son.
 */
export function pickSelectionPhotosForDesign<T extends { photoId?: number | null }>(
  selectionPhotos: T[],
  resolution: Pick<DesignTemplateResolution, "source" | "benefitStableKeys">,
  photoIdsByBenefitKey: Map<string, number[]> | null | undefined,
): T[] {
  if (resolution.source !== "PACK_REQUIRED") return selectionPhotos;
  if (!photoIdsByBenefitKey) return selectionPhotos;

  const permitidas = new Set<number>();
  for (const key of resolution.benefitStableKeys) {
    for (const photoId of photoIdsByBenefitKey.get(key) ?? []) permitidas.add(photoId);
  }
  if (permitidas.size === 0) return selectionPhotos;

  return selectionPhotos.filter((p) => p.photoId != null && permitidas.has(p.photoId));
}
