import type { PricingConfigurationIssue, PricingEquipmentItem, PricingProfile } from "../models.js";
import { PricingIssueCode } from "../issue-codes.js";
import { issue } from "../issues.js";
import { amountToCompatibleString } from "./amount-strings.js";
import type {
  CompatibleEquipmentInventory,
  CompatibleRenewalCameraData,
} from "./compatible-models.js";

export type MapEquipmentResult = {
  inventory: CompatibleEquipmentInventory;
  primaryCamera: {
    primaryCameraPresetId: string;
    primaryCameraCustomName: string;
    primaryCameraShutterRating: string;
    primaryCameraCurrentShutterCount: string;
    primaryCameraReplacementValue: string;
    estimatedAnnualShots: string;
  };
  warnings: PricingConfigurationIssue[];
};

function emptyInventory(): CompatibleEquipmentInventory {
  return {
    renewal: {
      camera: null,
      lenses: [],
      memoryCards: null,
      computer: null,
      monitor: null,
      storageDisks: null,
      speedlight: null,
      studioFlash: null,
      aaBatteries: null,
    },
    futureEquipment: [],
  };
}

function cameraFromItem(item: PricingEquipmentItem): CompatibleRenewalCameraData {
  return {
    presetId: "",
    customName: item.label,
    shutterRating: amountToCompatibleString(item.shutterRating),
    currentShutterCount: amountToCompatibleString(item.currentShutterCount),
    replacementValue: amountToCompatibleString(item.replacementValue),
    resaleValue: "",
    estimatedAnnualShots: amountToCompatibleString(item.estimatedAnnualShots),
  };
}

/**
 * Traduce inventario DNX → equipmentInventory + campos legacy de cámara.
 * No calcula wear ni depreciación.
 */
export function mapPricingEquipmentToCompatibleEquipment(
  profile: PricingProfile,
): MapEquipmentResult {
  const warnings: PricingConfigurationIssue[] = [];
  const inventory = emptyInventory();
  const enabled = profile.equipment.filter((e) => e.enabled);

  if (profile.equipment.length === 0) {
    warnings.push(
      issue(
        PricingIssueCode.EQUIPMENT_EMPTY,
        "equipment",
        "WARNING",
        "Inventario vacío; el motor usará solo reservas mensuales de equipo.",
      ),
    );
  }

  const cameras = enabled.filter((e) => e.category === "CAMERA");
  const lenses = enabled.filter((e) => e.category === "LENS");
  const flashes = enabled.filter((e) => e.category === "FLASH");
  const computers = enabled.filter((e) => e.category === "COMPUTER");
  const disks = enabled.filter((e) => e.category === "DISK");
  const memories = enabled.filter((e) => e.category === "MEMORY");
  const others = enabled.filter((e) => e.category === "OTHER");

  for (const item of others) {
    warnings.push(
      issue(
        PricingIssueCode.ADAPTER_INVALID_EQUIPMENT,
        `equipment.${item.id}`,
        "WARNING",
        `Equipo OTHER "${item.label}" omitido: sin categoría exacta en el inventario del motor.`,
      ),
    );
  }

  if (cameras[0]) {
    inventory.renewal.camera = cameraFromItem(cameras[0]);
    if (cameras.length > 1) {
      warnings.push(
        issue(
          PricingIssueCode.ADAPTER_INVALID_EQUIPMENT,
          "equipment",
          "WARNING",
          "Varias cámaras habilitadas: solo la primera se mapea al slot camera del motor.",
        ),
      );
    }
  }

  inventory.renewal.lenses = lenses.map((lens) => ({
    id: lens.id,
    model: lens.label,
    replacementValue: amountToCompatibleString(lens.replacementValue),
    yearsOwned: amountToCompatibleString(lens.ageYears),
    resaleValue: "",
  }));

  if (memories[0]) {
    inventory.renewal.memoryCards = {
      quantity: amountToCompatibleString(memories[0].quantity ?? 1),
      averagePrice: amountToCompatibleString(memories[0].replacementValue),
    };
  }

  if (computers[0]) {
    inventory.renewal.computer = {
      replacementValue: amountToCompatibleString(computers[0].replacementValue),
      yearsOwned: amountToCompatibleString(computers[0].ageYears),
    };
  }

  if (disks[0]) {
    inventory.renewal.storageDisks = {
      currentCapacityTb: "",
      replacementPrice: amountToCompatibleString(disks[0].replacementValue),
    };
  }

  if (flashes[0]) {
    inventory.renewal.speedlight = {
      quantity: amountToCompatibleString(flashes[0].quantity ?? 1),
      averagePrice: amountToCompatibleString(flashes[0].replacementValue),
      lifespanYears: amountToCompatibleString(flashes[0].usefulLifeYears),
      usesAABatteries: "",
    };
  }

  const primary = inventory.renewal.camera;
  return {
    inventory,
    primaryCamera: {
      primaryCameraPresetId: primary?.presetId ?? "",
      primaryCameraCustomName: primary?.customName ?? "",
      primaryCameraShutterRating: primary?.shutterRating ?? "",
      primaryCameraCurrentShutterCount: primary?.currentShutterCount ?? "",
      primaryCameraReplacementValue: primary?.replacementValue ?? "",
      estimatedAnnualShots: primary?.estimatedAnnualShots ?? "",
    },
    warnings,
  };
}
