import { parseCuantoCobroAmount } from "./amount-format";
import {
  getCameraCostPerShot,
  getEquipmentDepreciationMode,
  isCameraWearConfigured,
  resolveShutterRating,
  type EquipmentDepreciationMode,
} from "./camera-equipment";
import { parseQuoteItemQuantity } from "./quote-items";
import { PRIMARY_CAMERA_ID, resolveProfileCameras, type ResolvedCamera } from "./cameras";
import type { CameraWearModel, CuantoCobroProfileInput, CuantoCobroQuoteItem } from "./types";

export type { EquipmentDepreciationMode };

export type CameraWearPolicy = {
  mode: EquipmentDepreciationMode;
  /** De la cámara principal (#1). */
  costPerShot: number | null;
  isCameraConfigured: boolean;
  /** Todas las cámaras (la principal primero). Ausente en políticas armadas a mano: sólo la principal. */
  cameras?: ResolvedCamera[];
};

export type ConceptCameraWearBreakdown = {
  estimatedShots: number;
  cameraWearInformative: number;
  cameraWearCharged: number;
};

export function buildCameraWearPolicy(
  profile: CuantoCobroProfileInput,
  model: CameraWearModel = "per-job",
): CameraWearPolicy {
  return {
    mode: getEquipmentDepreciationMode(profile, model),
    costPerShot: getCameraCostPerShot(profile),
    isCameraConfigured: isCameraWearConfigured(profile),
    cameras: resolveProfileCameras(profile),
  };
}

/** La cámara del concepto: "primary" si no eligió otra. */
export function getConceptCameraId(item: CuantoCobroQuoteItem): string {
  const id = typeof item.cameraId === "string" ? item.cameraId.trim() : "";
  return id || PRIMARY_CAMERA_ID;
}

/**
 * ¿El concepto lleva disparos? Servicio propio siempre (lo de siempre); producto físico sólo si eligió
 * una cámara (carnet). Tercerizados y gastos, nunca.
 */
function conceptUsesCamera(item: CuantoCobroQuoteItem): boolean {
  if (item.itemType === "own-service") return true;
  return item.itemType === "physical-product" && typeof item.cameraId === "string" && item.cameraId.trim() !== "";
}

export function getConceptEstimatedShots(item: CuantoCobroQuoteItem): number {
  if (!conceptUsesCamera(item)) return 0;
  const unitShots = parseCuantoCobroAmount(item.estimatedShots) ?? 0;
  if (unitShots <= 0) return 0;
  if (item.shotsPer === "job") return Math.round(unitShots);
  return Math.round(unitShots * parseQuoteItemQuantity(item.quantity));
}

function costPerShotFor(item: CuantoCobroQuoteItem, policy: CameraWearPolicy): number | null {
  const id = getConceptCameraId(item);
  if (id === PRIMARY_CAMERA_ID || !policy.cameras) return id === PRIMARY_CAMERA_ID ? policy.costPerShot : null;
  return policy.cameras.find((c) => c.id === id)?.costPerShot ?? null;
}

export function calculateConceptCameraWear(
  item: CuantoCobroQuoteItem,
  policy: CameraWearPolicy,
): ConceptCameraWearBreakdown {
  const estimatedShots = getConceptEstimatedShots(item);
  const costPerShot = costPerShotFor(item, policy);
  if (estimatedShots <= 0 || costPerShot === null) {
    return { estimatedShots, cameraWearInformative: 0, cameraWearCharged: 0 };
  }

  const wear = Math.round(estimatedShots * costPerShot);
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
  // Otras cámaras: cada una avisa por su cuenta; lo de abajo es sólo la principal (lo de siempre).
  const otherItems = items.filter((i) => getConceptCameraId(i) !== PRIMARY_CAMERA_ID && getConceptEstimatedShots(i) > 0);
  for (const item of otherItems) {
    const camera = policy.cameras?.find((c) => c.id === getConceptCameraId(item));
    const label = item.name.trim() || "Un concepto";
    if (!camera) warnings.push(`«${label}» usa una cámara que ya no está en tu perfil: su desgaste no se sumó.`);
    else if (camera.costPerShot === null) {
      warnings.push(`«${label}» usa la cámara «${camera.name}», que no tiene valor de reposición o vida útil: su desgaste no se sumó.`);
    }
  }
  const totalShots = sumQuoteEstimatedShots(items.filter((i) => getConceptCameraId(i) === PRIMARY_CAMERA_ID));

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

  // Sólo en presupuestos guardados con el modelo anterior.
  if (policy.mode === "structural") {
    warnings.push(
      "Presupuesto calculado con el modelo anterior: la cámara estaba en la renovación mensual del perfil y el desgaste de este trabajo no se sumó al precio.",
    );
  }

  return warnings;
}
