import { computeEquipmentSavings } from "./calculations";
import {
  INITIAL_EQUIPMENT_INVENTORY,
  normalizeEquipmentInventory,
  syncProfileCameraFromInventory,
} from "./normalize";
import type { CuantoCobroEquipmentInventory } from "./types";
import type { CuantoCobroProfileInput } from "../types";

export function getProfileEquipmentInventory(profile: CuantoCobroProfileInput): CuantoCobroEquipmentInventory {
  return normalizeEquipmentInventory(profile.equipmentInventory ?? INITIAL_EQUIPMENT_INVENTORY, profile);
}

export function applyEquipmentInventory(
  profile: CuantoCobroProfileInput,
  inventory: CuantoCobroEquipmentInventory,
): CuantoCobroProfileInput {
  const synced = syncProfileCameraFromInventory({ ...profile, equipmentInventory: inventory }, inventory);
  const savings = computeEquipmentSavings(synced);
  return {
    ...synced,
    equipmentRenewalMonthly: savings.renewalMonthly > 0 ? String(savings.renewalMonthly) : profile.equipmentRenewalMonthly,
  };
}

export function updateEquipmentInventory(
  profile: CuantoCobroProfileInput,
  updater: (inventory: CuantoCobroEquipmentInventory) => CuantoCobroEquipmentInventory,
): CuantoCobroProfileInput {
  const current = getProfileEquipmentInventory(profile);
  return applyEquipmentInventory(profile, updater(current));
}
