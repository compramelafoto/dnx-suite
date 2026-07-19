import { parseCuantoCobroAmount } from "./amount-format";
import {
  getCameraCostPerShot,
  getEquipmentDepreciationMode,
  isCameraWearConfigured,
  resolveShutterRating,
  type EquipmentDepreciationMode,
} from "./camera-equipment";
import { parseQuoteItemQuantity } from "./quote-items";
import type { CuantoCobroProfileInput, CuantoCobroQuoteItem } from "./types";

export type { EquipmentDepreciationMode };

export type CameraWearPolicy = {
  mode: EquipmentDepreciationMode;
  costPerShot: number | null;
  isCameraConfigured: boolean;
};

export type ConceptCameraWearBreakdown = {
  estimatedShots: number;
  cameraWearInformative: number;
  cameraWearCharged: number;
};

export function buildCameraWearPolicy(profile: CuantoCobroProfileInput): CameraWearPolicy {
  return {
    mode: getEquipmentDepreciationMode(profile),
    costPerShot: getCameraCostPerShot(profile),
    isCameraConfigured: isCameraWearConfigured(profile),
  };
}

export function getConceptEstimatedShots(item: CuantoCobroQuoteItem): number {
  if (item.itemType !== "own-service") return 0;
  const unitShots = parseCuantoCobroAmount(item.estimatedShots) ?? 0;
  if (unitShots <= 0) return 0;
  return Math.round(unitShots * parseQuoteItemQuantity(item.quantity));
}

export function calculateConceptCameraWear(
  item: CuantoCobroQuoteItem,
  policy: CameraWearPolicy,
): ConceptCameraWearBreakdown {
  const estimatedShots = getConceptEstimatedShots(item);
  if (estimatedShots <= 0 || policy.costPerShot === null) {
    return { estimatedShots, cameraWearInformative: 0, cameraWearCharged: 0 };
  }

  const wear = Math.round(estimatedShots * policy.costPerShot);
  return {
    estimatedShots,
    cameraWearInformative: wear,
    cameraWearCharged: policy.mode === "per-job" ? wear : 0,
  };
}

export function sumQuoteEstimatedShots(items: CuantoCobroQuoteItem[]): number {
  return items.reduce((total, item) => total + getConceptEstimatedShots(item), 0);
}

export function buildCameraWearWarnings(
  profile: CuantoCobroProfileInput,
  policy: CameraWearPolicy,
  items: CuantoCobroQuoteItem[],
): string[] {
  const warnings: string[] = [];
  const totalShots = sumQuoteEstimatedShots(items);

  if (totalShots <= 0) return warnings;

  if (!policy.isCameraConfigured) {
    const rating = resolveShutterRating(profile);
    const replacement = parseCuantoCobroAmount(profile.primaryCameraReplacementValue) ?? 0;
    if (rating <= 0 && replacement <= 0) {
      warnings.push(
        "Hay productos o servicios con disparos estimados, pero la cámara principal no tiene valor de reposición ni vida útil configurados. El desgaste no se puede calcular.",
      );
    } else if (rating <= 0) {
      warnings.push(
        "Hay productos o servicios con disparos estimados, pero falta la vida útil del obturador (ciclos máximos) en tu perfil.",
      );
    } else {
      warnings.push(
        "Hay productos o servicios con disparos estimados, pero falta el valor de reposición de la cámara principal en tu perfil.",
      );
    }
    return warnings;
  }

  if (policy.mode === "structural") {
    warnings.push(
      "Modo estructural: el desgaste de cámara es informativo. Ya contemplás renovación de equipo en tu aporte mensual del perfil; no se suma de nuevo al precio.",
    );
  }

  return warnings;
}
