type AlbumPackConfigForValidation = {
  isActive: boolean;
  requiresSelection: boolean;
  includedPhotoCount: number | null;
  requiresDesign: boolean;
  templateId: number | null;
  availabilityPhase: "PRE_UPLOAD" | "POST_UPLOAD" | "ALWAYS";
  /** Opcional: indica si la plantilla vinculada existe en el listado cargado en UI. */
  templateAvailable?: boolean;
};

export function validateAlbumPackConfig(pack: AlbumPackConfigForValidation): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  badges: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const badges: string[] = [];

  if (!pack.isActive) {
    badges.push("Inactivo");
    warnings.push("Este pack no está visible.");
  }

  if (pack.requiresSelection && (!Number.isFinite(pack.includedPhotoCount) || Number(pack.includedPhotoCount) <= 0)) {
    errors.push("Falta cantidad de fotos.");
    badges.push("Falta cantidad de fotos");
  }

  if (pack.requiresDesign && !pack.templateId) {
    errors.push("Falta plantilla.");
    badges.push("Falta plantilla");
  }

  if (pack.requiresDesign && pack.templateId && pack.templateAvailable === false) {
    errors.push("La plantilla asociada no se encontró.");
  }

  if (pack.availabilityPhase === "PRE_UPLOAD") {
    badges.push("Antes de subir fotos");
  } else if (pack.availabilityPhase === "POST_UPLOAD") {
    badges.push("Después de subir fotos");
  } else {
    badges.push("Siempre disponible");
  }

  if (pack.isActive && errors.length === 0) {
    badges.push("Listo para prueba interna");
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    badges,
  };
}
