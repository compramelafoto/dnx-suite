import { parseCuantoCobroAmount } from "../amount-format.js";
import type { CuantoCobroProfileInput } from "../types.js";
import {
  DEFAULT_CAMERA_SHUTTER_RATING,
  DEFAULT_COMPUTER_LIFESPAN_YEARS,
  DEFAULT_MONITOR_LIFESPAN_YEARS,
  DEFAULT_SPEEDLIGHT_LIFESPAN_YEARS,
  DEFAULT_STUDIO_FLASH_LIFESPAN_YEARS,
} from "./constants.js";
import type {
  CuantoCobroEquipmentInventory,
  CuantoCobroEquipmentRenewal,
  FutureEquipmentItem,
  RenewalCameraData,
  RenewalLensItem,
} from "./types.js";

export const INITIAL_EQUIPMENT_RENEWAL: CuantoCobroEquipmentRenewal = {
  camera: null,
  lenses: [],
  memoryCards: null,
  computer: null,
  monitor: null,
  storageDisks: null,
  speedlight: null,
  studioFlash: null,
  aaBatteries: null,
};

export const INITIAL_EQUIPMENT_INVENTORY: CuantoCobroEquipmentInventory = {
  renewal: { ...INITIAL_EQUIPMENT_RENEWAL, lenses: [] },
  futureEquipment: [],
};

function hasCameraLegacyData(raw: Partial<CuantoCobroProfileInput>): boolean {
  return Boolean(
    raw.primaryCameraPresetId?.trim() ||
      raw.primaryCameraCustomName?.trim() ||
      raw.primaryCameraShutterRating?.trim() ||
      raw.primaryCameraCurrentShutterCount?.trim() ||
      raw.primaryCameraReplacementValue?.trim() ||
      raw.estimatedAnnualShots?.trim(),
  );
}

export function cameraFromLegacyProfile(raw: Partial<CuantoCobroProfileInput>): RenewalCameraData | null {
  if (!hasCameraLegacyData(raw)) return null;
  const shutterRating =
    raw.primaryCameraShutterRating?.trim() || String(DEFAULT_CAMERA_SHUTTER_RATING);
  return {
    presetId: raw.primaryCameraPresetId ?? "",
    customName: raw.primaryCameraCustomName ?? "",
    shutterRating,
    currentShutterCount: raw.primaryCameraCurrentShutterCount ?? "",
    replacementValue: raw.primaryCameraReplacementValue ?? "",
    resaleValue: "",
    estimatedAnnualShots: raw.estimatedAnnualShots ?? "",
  };
}

const EMPTY_CAMERA_LEGACY_FIELDS = {
  primaryCameraPresetId: "",
  primaryCameraCustomName: "",
  primaryCameraShutterRating: "",
  primaryCameraCurrentShutterCount: "",
  primaryCameraReplacementValue: "",
  estimatedAnnualShots: "",
} as const;

function cameraToLegacyFields(camera: RenewalCameraData | null): Pick<
  CuantoCobroProfileInput,
  | "primaryCameraPresetId"
  | "primaryCameraCustomName"
  | "primaryCameraShutterRating"
  | "primaryCameraCurrentShutterCount"
  | "primaryCameraReplacementValue"
  | "estimatedAnnualShots"
> {
  if (!camera) {
    return { ...EMPTY_CAMERA_LEGACY_FIELDS };
  }
  return {
    primaryCameraPresetId: camera.presetId,
    primaryCameraCustomName: camera.customName,
    primaryCameraShutterRating: camera.shutterRating,
    primaryCameraCurrentShutterCount: camera.currentShutterCount,
    primaryCameraReplacementValue: camera.replacementValue,
    estimatedAnnualShots: camera.estimatedAnnualShots,
  };
}

function normalizeRenewalCamera(camera: RenewalCameraData | null | undefined): RenewalCameraData | null {
  if (!camera) return null;
  const replacementValue = camera.replacementValue?.trim() ?? "";
  const presetId = camera.presetId?.trim() ?? "";
  if (!replacementValue && !presetId) return null;
  return {
    presetId: camera.presetId ?? "",
    customName: camera.customName ?? "",
    shutterRating: camera.shutterRating?.trim() || String(DEFAULT_CAMERA_SHUTTER_RATING),
    currentShutterCount: camera.currentShutterCount ?? "",
    replacementValue,
    resaleValue: camera.resaleValue ?? "",
    estimatedAnnualShots: camera.estimatedAnnualShots ?? "",
  };
}

function normalizeLensItem(item: Partial<RenewalLensItem>): RenewalLensItem | null {
  const model = item.model?.trim() ?? "";
  const replacementValue = item.replacementValue?.trim() ?? "";
  if (!model && !replacementValue) return null;
  return {
    id: item.id?.trim() || `lens-${Date.now()}`,
    model,
    replacementValue,
    yearsOwned: item.yearsOwned ?? "",
    resaleValue: item.resaleValue ?? "",
  };
}

function normalizeFutureItem(item: Partial<FutureEquipmentItem>): FutureEquipmentItem | null {
  const name = item.name?.trim() ?? "";
  const estimatedPrice = item.estimatedPrice?.trim() ?? "";
  const id = item.id?.trim() ?? "";
  if (!name && !estimatedPrice && !id) return null;
  return {
    id: id || `future-${Date.now()}`,
    purpose: "FUTURE_EXPANSION_EQUIPMENT",
    category: item.category ?? "other",
    name,
    estimatedPrice,
    desiredTimeline: item.desiredTimeline ?? "",
    note: item.note ?? "",
  };
}

function normalizeRenewal(raw: Partial<CuantoCobroEquipmentRenewal> | undefined): CuantoCobroEquipmentRenewal {
  const lenses = (raw?.lenses ?? [])
    .map((item) => normalizeLensItem(item))
    .filter((item): item is RenewalLensItem => item !== null);

  return {
    camera: normalizeRenewalCamera(raw?.camera),
    lenses,
    memoryCards:
      raw?.memoryCards &&
      (raw.memoryCards.quantity?.trim() || raw.memoryCards.averagePrice?.trim())
        ? {
            quantity: raw.memoryCards.quantity ?? "",
            averagePrice: raw.memoryCards.averagePrice ?? "",
          }
        : null,
    computer:
      raw?.computer && raw.computer.replacementValue?.trim()
        ? {
            replacementValue: raw.computer.replacementValue,
            yearsOwned: raw.computer.yearsOwned ?? "",
          }
        : null,
    monitor:
      raw?.monitor && raw.monitor.replacementValue?.trim()
        ? {
            replacementValue: raw.monitor.replacementValue,
            yearsOwned: raw.monitor.yearsOwned ?? "",
          }
        : null,
    storageDisks:
      raw?.storageDisks &&
      (raw.storageDisks.currentCapacityTb?.trim() || raw.storageDisks.replacementPrice?.trim())
        ? {
            currentCapacityTb: raw.storageDisks.currentCapacityTb ?? "",
            replacementPrice: raw.storageDisks.replacementPrice ?? "",
          }
        : null,
    speedlight:
      raw?.speedlight &&
      (raw.speedlight.quantity?.trim() || raw.speedlight.averagePrice?.trim())
        ? {
            quantity: raw.speedlight.quantity ?? "",
            averagePrice: raw.speedlight.averagePrice ?? "",
            lifespanYears:
              raw.speedlight.lifespanYears?.trim() || String(DEFAULT_SPEEDLIGHT_LIFESPAN_YEARS),
            usesAABatteries: raw.speedlight.usesAABatteries ?? "",
          }
        : null,
    studioFlash:
      raw?.studioFlash &&
      (raw.studioFlash.quantity?.trim() || raw.studioFlash.averagePrice?.trim())
        ? {
            quantity: raw.studioFlash.quantity ?? "",
            averagePrice: raw.studioFlash.averagePrice ?? "",
            lifespanYears:
              raw.studioFlash.lifespanYears?.trim() || String(DEFAULT_STUDIO_FLASH_LIFESPAN_YEARS),
          }
        : null,
    aaBatteries:
      raw?.aaBatteries && raw.aaBatteries.monthlyCost?.trim()
        ? { monthlyCost: raw.aaBatteries.monthlyCost }
        : null,
  };
}

export function normalizeEquipmentInventory(
  raw: Partial<CuantoCobroEquipmentInventory> | undefined,
  legacyProfile?: Partial<CuantoCobroProfileInput>,
): CuantoCobroEquipmentInventory {
  const renewal = normalizeRenewal(raw?.renewal);
  const futureEquipment = (raw?.futureEquipment ?? [])
    .map((item) => normalizeFutureItem(item))
    .filter((item): item is FutureEquipmentItem => item !== null);

  if (!renewal.camera && legacyProfile) {
    const legacyCamera = cameraFromLegacyProfile(legacyProfile);
    if (legacyCamera) {
      renewal.camera = legacyCamera;
    }
  }

  return { renewal, futureEquipment };
}

export function syncProfileCameraFromInventory(
  profile: CuantoCobroProfileInput,
  inventory: CuantoCobroEquipmentInventory,
): CuantoCobroProfileInput {
  return {
    ...profile,
    equipmentInventory: inventory,
    ...cameraToLegacyFields(inventory.renewal.camera),
  };
}

export function normalizeEquipmentProfileFields(
  raw: Partial<CuantoCobroProfileInput>,
): Pick<CuantoCobroProfileInput, "equipmentInventory"> &
  Pick<
    CuantoCobroProfileInput,
    | "primaryCameraPresetId"
    | "primaryCameraCustomName"
    | "primaryCameraShutterRating"
    | "primaryCameraCurrentShutterCount"
    | "primaryCameraReplacementValue"
    | "estimatedAnnualShots"
  > {
  const inventory = normalizeEquipmentInventory(raw.equipmentInventory, raw);
  const syncedCamera = cameraToLegacyFields(inventory.renewal.camera);

  if (!inventory.renewal.camera && hasCameraLegacyData(raw)) {
    inventory.renewal.camera = cameraFromLegacyProfile(raw);
  }

  return {
    equipmentInventory: inventory,
    ...syncedCamera,
  };
}

export function hasStructuredEquipmentData(inventory: CuantoCobroEquipmentInventory): boolean {
  const { renewal, futureEquipment } = inventory;
  if (futureEquipment.length > 0) return true;
  if (renewal.camera) return true;
  if (renewal.lenses.length > 0) return true;
  if (renewal.memoryCards) return true;
  if (renewal.computer) return true;
  if (renewal.monitor) return true;
  if (renewal.storageDisks) return true;
  if (renewal.speedlight) return true;
  if (renewal.studioFlash) return true;
  if (renewal.aaBatteries) return true;
  return false;
}

export function usesLegacyRenewalFallback(
  profile: CuantoCobroProfileInput,
  inventory: CuantoCobroEquipmentInventory,
): boolean {
  const legacyAmount = parseCuantoCobroAmount(profile.equipmentRenewalMonthly) ?? 0;
  return legacyAmount > 0 && !hasStructuredEquipmentData(inventory);
}
