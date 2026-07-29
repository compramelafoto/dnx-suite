/**
 * Prioridad de portada editorial (compatibilidad hacia atrás).
 *
 * 1. Imagen subida específicamente para la nota (UPLOAD)
 * 2. Imagen seleccionada desde cobertura CLF (CLF_PHOTO)
 * 3. Placeholder institucional (sin asset)
 */

export type CoverSourceType = "UPLOAD" | "CLF_PHOTO" | null;

export type CoverOriginLabel =
  | "upload"
  | "clf"
  | "placeholder";

export type ResolvedCoverOrigin = {
  origin: CoverOriginLabel;
  label: string;
  priorityNote: string;
  sourceType: CoverSourceType;
};

export function resolveCoverOrigin(input: {
  coverImageId?: string | null;
  sourceType?: CoverSourceType | string | null;
}): ResolvedCoverOrigin {
  const id = input.coverImageId?.trim() || null;
  const source =
    input.sourceType === "UPLOAD" || input.sourceType === "CLF_PHOTO"
      ? input.sourceType
      : null;

  if (!id) {
    return {
      origin: "placeholder",
      label: "Sin portada — se usará el placeholder institucional",
      priorityNote:
        "Prioridad: 1) imagen subida · 2) foto de cobertura CLF · 3) placeholder InfoSpot",
      sourceType: null,
    };
  }

  if (source === "UPLOAD") {
    return {
      origin: "upload",
      label: "Portada propia (subida a InfoSpot)",
      priorityNote: "Tiene prioridad sobre cualquier foto de cobertura CLF",
      sourceType: "UPLOAD",
    };
  }

  if (source === "CLF_PHOTO") {
    return {
      origin: "clf",
      label: "Portada desde cobertura CLF",
      priorityNote:
        "Se usa porque no hay imagen propia subida. Podés reemplazarla subiendo una portada.",
      sourceType: "CLF_PHOTO",
    };
  }

  // Asset legacy o sin sourceType cargado: se mantiene como portada efectiva.
  return {
    origin: "upload",
    label: "Portada asignada",
    priorityNote:
      "Prioridad: 1) imagen subida · 2) foto de cobertura CLF · 3) placeholder InfoSpot",
    sourceType: null,
  };
}

/** Elige la URL de portada para cards/listados respetando la prioridad. */
export function pickCoverDisplayUrl(input: {
  uploadedCoverUrl?: string | null;
  clfCoverUrl?: string | null;
  placeholderUrl?: string | null;
}): string | null {
  const uploaded = input.uploadedCoverUrl?.trim() || null;
  if (uploaded) return uploaded;
  const clf = input.clfCoverUrl?.trim() || null;
  if (clf) return clf;
  return input.placeholderUrl?.trim() || null;
}
