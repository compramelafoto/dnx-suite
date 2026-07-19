import { parseCuantoCobroAmount } from "./amount-format";
import { getEffectiveRenewalMonthly } from "./equipment/calculations";
import type { CuantoCobroProfileInput, CuantoCobroQuoteInput } from "./types";
import { getQuoteConcepts } from "./quote-access";
import { getQuoteTotalEstimatedShots } from "./quote-items";

export type EquipmentDepreciationMode = "structural" | "per-job";

export type CameraBodyPreset = {
  id: string;
  label: string;
  shutterRating: number;
};

export const CAMERA_BODY_PRESETS: CameraBodyPreset[] = [
  { id: "canon-r6", label: "Canon EOS R6 / R6 II", shutterRating: 200_000 },
  { id: "canon-r5", label: "Canon EOS R5 / R5 II", shutterRating: 500_000 },
  { id: "nikon-z6", label: "Nikon Z6 / Z6 II / Z6 III", shutterRating: 200_000 },
  { id: "nikon-z8", label: "Nikon Z8 / Z9", shutterRating: 500_000 },
  { id: "sony-a7iv", label: "Sony A7 IV / A7C II", shutterRating: 200_000 },
  { id: "sony-a9", label: "Sony A9 / A9 II / A9 III", shutterRating: 500_000 },
  { id: "fuji-xh2", label: "Fujifilm X-H2 / X-H2S", shutterRating: 200_000 },
  { id: "fuji-xt5", label: "Fujifilm X-T5 / X-S20", shutterRating: 150_000 },
  { id: "entry-level", label: "Réflex / mirrorless entrada (~100.000)", shutterRating: 100_000 },
  { id: "custom", label: "Otro modelo (carga manual)", shutterRating: 0 },
];

export type CameraWearAnalysis = {
  isConfigured: boolean;
  cameraLabel: string;
  shutterRating: number;
  currentShutterCount: number;
  remainingActuations: number;
  remainingLifePercent: number;
  usedLifePercent: number;
  replacementValue: number;
  costPerShot: number | null;
  estimatedAnnualShots: number;
  suggestedMonthlyRenewal: number | null;
  jobShots: number;
  jobWearCost: number | null;
  /** Igual que jobWearCost cuando la cámara está configurada. */
  jobWearCostInformative: number | null;
  /** Solo en modo per-job; lo que suma al precio del presupuesto. */
  jobWearCostCharged: number | null;
  depreciationMode: EquipmentDepreciationMode;
  jobWearPercentOfRating: number | null;
  jobWearPercentOfRemaining: number | null;
};

export const INITIAL_CAMERA_PROFILE_FIELDS = {
  primaryCameraPresetId: "",
  primaryCameraCustomName: "",
  primaryCameraShutterRating: "",
  primaryCameraCurrentShutterCount: "",
  primaryCameraReplacementValue: "",
  estimatedAnnualShots: "",
} as const;

function parseActuationCount(value: string): number {
  const parsed = parseCuantoCobroAmount(value);
  if (parsed === null || parsed < 0) return 0;
  return Math.round(parsed);
}

export function getCameraPreset(presetId: string): CameraBodyPreset | undefined {
  return CAMERA_BODY_PRESETS.find((preset) => preset.id === presetId);
}

export function getCameraDisplayLabel(profile: CuantoCobroProfileInput): string {
  if (profile.primaryCameraPresetId === "custom") {
    return profile.primaryCameraCustomName.trim() || "Cámara personalizada";
  }
  const preset = getCameraPreset(profile.primaryCameraPresetId);
  return preset?.label ?? "Cámara principal";
}

export function resolveShutterRating(profile: CuantoCobroProfileInput): number {
  const manual = parseActuationCount(profile.primaryCameraShutterRating);
  if (manual > 0) return manual;
  const preset = getCameraPreset(profile.primaryCameraPresetId);
  return preset && preset.id !== "custom" ? preset.shutterRating : 0;
}

export function getEquipmentDepreciationMode(profile: CuantoCobroProfileInput): EquipmentDepreciationMode {
  const renewal = getEffectiveRenewalMonthly(profile);
  return renewal > 0 ? "structural" : "per-job";
}

export function isCameraWearConfigured(profile: CuantoCobroProfileInput): boolean {
  return resolveShutterRating(profile) > 0 && (parseCuantoCobroAmount(profile.primaryCameraReplacementValue) ?? 0) > 0;
}

/** Costo por disparo = valor de reposición / vida útil en disparos. */
export function getCameraCostPerShot(profile: CuantoCobroProfileInput): number | null {
  const shutterRating = resolveShutterRating(profile);
  const replacementValue = parseCuantoCobroAmount(profile.primaryCameraReplacementValue) ?? 0;
  if (shutterRating <= 0 || replacementValue <= 0) return null;
  return replacementValue / shutterRating;
}

export function analyzeCameraWear(
  profile: CuantoCobroProfileInput,
  quote?: CuantoCobroQuoteInput,
): CameraWearAnalysis {
  const shutterRating = resolveShutterRating(profile);
  const currentShutterCount = parseActuationCount(profile.primaryCameraCurrentShutterCount);
  const replacementValue = parseCuantoCobroAmount(profile.primaryCameraReplacementValue) ?? 0;
  const estimatedAnnualShots = parseActuationCount(profile.estimatedAnnualShots);
  const jobShots = quote ? getQuoteTotalEstimatedShots(getQuoteConcepts(quote)) : 0;

  const costPerShot = getCameraCostPerShot(profile);
  const isConfigured = costPerShot !== null;
  const depreciationMode = getEquipmentDepreciationMode(profile);
  const remainingActuations = Math.max(0, shutterRating - currentShutterCount);
  const remainingLifePercent =
    shutterRating > 0 ? Math.round((remainingActuations / shutterRating) * 1000) / 10 : 0;
  const usedLifePercent =
    shutterRating > 0 ? Math.round((currentShutterCount / shutterRating) * 1000) / 10 : 0;
  const costPerShotValue = costPerShot;
  const suggestedMonthlyRenewal =
    costPerShotValue !== null && estimatedAnnualShots > 0
      ? Math.round((estimatedAnnualShots * costPerShotValue) / 12)
      : null;

  const jobWearCostInformative =
    costPerShotValue !== null && jobShots > 0 ? Math.round(costPerShotValue * jobShots) : null;
  const jobWearCostCharged =
    depreciationMode === "per-job" ? jobWearCostInformative : null;
  const jobWearCost = jobWearCostInformative;
  const jobWearPercentOfRating =
    shutterRating > 0 && jobShots > 0 ? Math.round((jobShots / shutterRating) * 1000) / 10 : null;
  const jobWearPercentOfRemaining =
    remainingActuations > 0 && jobShots > 0
      ? Math.round((jobShots / remainingActuations) * 1000) / 10
      : null;

  return {
    isConfigured,
    cameraLabel: getCameraDisplayLabel(profile),
    shutterRating,
    currentShutterCount,
    remainingActuations,
    remainingLifePercent,
    usedLifePercent,
    replacementValue,
    costPerShot: costPerShotValue,
    estimatedAnnualShots,
    suggestedMonthlyRenewal,
    jobShots,
    jobWearCost,
    jobWearCostInformative,
    jobWearCostCharged,
    depreciationMode,
    jobWearPercentOfRating,
    jobWearPercentOfRemaining,
  };
}

export function normalizeCameraProfileFields(
  raw: Partial<CuantoCobroProfileInput>,
): Pick<
  CuantoCobroProfileInput,
  | "primaryCameraPresetId"
  | "primaryCameraCustomName"
  | "primaryCameraShutterRating"
  | "primaryCameraCurrentShutterCount"
  | "primaryCameraReplacementValue"
  | "estimatedAnnualShots"
> {
  return {
    primaryCameraPresetId: raw.primaryCameraPresetId ?? INITIAL_CAMERA_PROFILE_FIELDS.primaryCameraPresetId,
    primaryCameraCustomName: raw.primaryCameraCustomName ?? INITIAL_CAMERA_PROFILE_FIELDS.primaryCameraCustomName,
    primaryCameraShutterRating:
      raw.primaryCameraShutterRating ?? INITIAL_CAMERA_PROFILE_FIELDS.primaryCameraShutterRating,
    primaryCameraCurrentShutterCount:
      raw.primaryCameraCurrentShutterCount ?? INITIAL_CAMERA_PROFILE_FIELDS.primaryCameraCurrentShutterCount,
    primaryCameraReplacementValue:
      raw.primaryCameraReplacementValue ?? INITIAL_CAMERA_PROFILE_FIELDS.primaryCameraReplacementValue,
    estimatedAnnualShots: raw.estimatedAnnualShots ?? INITIAL_CAMERA_PROFILE_FIELDS.estimatedAnnualShots,
  };
}

export function formatActuationCount(value: number): string {
  return Math.round(value).toLocaleString("es-AR");
}
