type AlbumPackAvailabilityPhase = "PRE_UPLOAD" | "POST_UPLOAD" | "ALWAYS";

export type AlbumPackConfigInput = {
  requiresSelection: boolean;
  includedPhotoCount: number | null;
  requiresDesign: boolean;
  templateId: number | null;
  isActive: boolean;
  availabilityPhase: string;
  templateExists: boolean;
};

export type AlbumPackConfigValidation = {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  badges: string[];
};

function getAvailabilityBadge(availabilityPhase: string): string {
  switch (availabilityPhase as AlbumPackAvailabilityPhase) {
    case "PRE_UPLOAD":
      return "Solo preventa";
    case "POST_UPLOAD":
      return "Postventa";
    case "ALWAYS":
    default:
      return "Siempre disponible";
  }
}

export function validateAlbumPackConfig(
  input: AlbumPackConfigInput,
): AlbumPackConfigValidation {
  const warnings: string[] = [];
  const errors: string[] = [];
  const badges: string[] = [getAvailabilityBadge(input.availabilityPhase)];

  if (!input.isActive) {
    warnings.push("El pack está inactivo.");
    badges.push("Inactivo");
  }

  if (
    input.requiresSelection &&
    (input.includedPhotoCount == null || input.includedPhotoCount <= 0)
  ) {
    errors.push(
      "Requiere selección, pero falta una cantidad de fotos válida (> 0).",
    );
    badges.push("Falta cantidad de fotos");
  }

  if (input.requiresDesign && input.templateId == null) {
    errors.push("Requiere diseño, pero no tiene plantilla asociada.");
    badges.push("Falta plantilla");
  }

  if (
    input.requiresDesign &&
    input.templateId != null &&
    input.templateExists === false
  ) {
    errors.push(
      "La plantilla asociada no existe o no está disponible en este álbum.",
    );
    badges.push("Falta plantilla");
  }

  if (!input.requiresDesign) {
    warnings.push("Listo para venta digital simple.");
  } else if (errors.length === 0) {
    warnings.push("Configuración con diseño lista para prueba interna.");
  }

  const isReadyForInternalTest = errors.length === 0 && input.isActive;
  if (isReadyForInternalTest) {
    badges.push("Listo para prueba interna");
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    badges: Array.from(new Set(badges)),
  };
}
