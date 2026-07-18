import { parseCuantoCobroAmount } from "../amount-format.js";
import type { CuantoCobroProfileInput } from "../types.js";
import {
  AA_BATTERIES_PER_SPEEDLIGHT,
  DEFAULT_COMPUTER_LIFESPAN_YEARS,
  DEFAULT_LENS_LIFESPAN_YEARS,
  DEFAULT_MONITOR_LIFESPAN_YEARS,
  DEFAULT_STORAGE_AMORTIZATION_YEARS,
  MEMORY_CARD_REPLACEMENT_MONTHS,
  RENEWAL_CATEGORY_META,
} from "./constants.js";
import {
  hasStructuredEquipmentData,
  INITIAL_EQUIPMENT_INVENTORY,
  normalizeEquipmentInventory,
  usesLegacyRenewalFallback,
} from "./normalize.js";
import type {
  CuantoCobroEquipmentInventory,
  EquipmentCategoryCardMeta,
  EquipmentRenewalCategoryId,
  EquipmentSavingsBreakdown,
  RenewalCameraData,
} from "./types.js";

function parseCount(value: string | undefined): number {
  const parsed = parseCuantoCobroAmount(value ?? "");
  if (parsed === null || parsed < 0) return 0;
  return parsed;
}

function parseYearsOwned(value: string | undefined): number {
  const parsed = parseCount(value);
  return Math.max(0, parsed);
}

function amortizeOverRemainingYears(netValue: number, lifespanYears: number, yearsOwned: number): number | null {
  if (netValue <= 0) return null;
  const remainingYears = Math.max(1, lifespanYears - yearsOwned);
  return Math.round(netValue / (remainingYears * 12));
}

function amortizeOverYears(value: number, years: number): number | null {
  if (value <= 0 || years <= 0) return null;
  return Math.round(value / (years * 12));
}

function computeCameraRenewalMonthly(camera: RenewalCameraData): number | null {
  const replacementValue = parseCount(camera.replacementValue);
  const resaleValue = parseCount(camera.resaleValue);
  const netValue = Math.max(0, replacementValue - resaleValue);
  if (netValue <= 0) return null;

  const shutterRating = parseCount(camera.shutterRating);
  const currentShots = parseCount(camera.currentShutterCount);
  const annualShots = parseCount(camera.estimatedAnnualShots);

  if (shutterRating <= 0) return null;

  const remainingShots = Math.max(0, shutterRating - currentShots);

  if (remainingShots > 0 && annualShots > 0) {
    const monthlyShots = annualShots / 12;
    const monthsRemaining = remainingShots / monthlyShots;
    if (monthsRemaining > 0) {
      return Math.round(netValue / monthsRemaining);
    }
  }

  if (annualShots > 0) {
    const costPerShot = netValue / shutterRating;
    return Math.round((annualShots * costPerShot) / 12);
  }

  return amortizeOverYears(netValue, 5);
}

function computeSimpleQuantityMonthly(
  quantity: string,
  averagePrice: string,
  lifespanYears: number,
): number | null {
  const count = parseCount(quantity);
  const price = parseCount(averagePrice);
  if (count <= 0 || price <= 0) return null;
  return amortizeOverYears(count * price, lifespanYears);
}

function getInventory(profile: CuantoCobroProfileInput): CuantoCobroEquipmentInventory {
  return normalizeEquipmentInventory(profile.equipmentInventory ?? INITIAL_EQUIPMENT_INVENTORY, profile);
}

export function computeRenewalCategoryMonthly(
  categoryId: EquipmentRenewalCategoryId,
  inventory: CuantoCobroEquipmentInventory,
): number | null {
  const { renewal } = inventory;

  switch (categoryId) {
    case "camera":
      return renewal.camera ? computeCameraRenewalMonthly(renewal.camera) : null;
    case "lenses": {
      const totals = renewal.lenses
        .map((lens) => {
          const net =
            Math.max(0, parseCount(lens.replacementValue) - parseCount(lens.resaleValue));
          return amortizeOverRemainingYears(
            net,
            DEFAULT_LENS_LIFESPAN_YEARS,
            parseYearsOwned(lens.yearsOwned),
          );
        })
        .filter((value): value is number => value !== null);
      return totals.length > 0 ? totals.reduce((sum, value) => sum + value, 0) : null;
    }
    case "memory-cards": {
      const price = parseCount(renewal.memoryCards?.averagePrice);
      if (price <= 0) return null;
      return Math.round(price / MEMORY_CARD_REPLACEMENT_MONTHS);
    }
    case "computer": {
      const value = parseCount(renewal.computer?.replacementValue);
      return amortizeOverRemainingYears(
        value,
        DEFAULT_COMPUTER_LIFESPAN_YEARS,
        parseYearsOwned(renewal.computer?.yearsOwned),
      );
    }
    case "monitor": {
      const value = parseCount(renewal.monitor?.replacementValue);
      return amortizeOverRemainingYears(
        value,
        DEFAULT_MONITOR_LIFESPAN_YEARS,
        parseYearsOwned(renewal.monitor?.yearsOwned),
      );
    }
    case "storage-disks": {
      const price = parseCount(renewal.storageDisks?.replacementPrice);
      return amortizeOverYears(price, DEFAULT_STORAGE_AMORTIZATION_YEARS);
    }
    case "speedlight": {
      const data = renewal.speedlight;
      if (!data) return null;
      const lifespan = parseCount(data.lifespanYears) || 5;
      return computeSimpleQuantityMonthly(data.quantity, data.averagePrice, lifespan);
    }
    case "studio-flash": {
      const data = renewal.studioFlash;
      if (!data) return null;
      const lifespan = parseCount(data.lifespanYears) || 8;
      return computeSimpleQuantityMonthly(data.quantity, data.averagePrice, lifespan);
    }
    case "aa-batteries": {
      const monthly = parseCount(renewal.aaBatteries?.monthlyCost);
      return monthly > 0 ? monthly : null;
    }
    default:
      return null;
  }
}

function timelineToMonths(timeline: string): number | null {
  switch (timeline) {
    case "1":
      return 12;
    case "2":
      return 24;
    case "3":
      return 36;
    default:
      return null;
  }
}

export function computeEquipmentSavings(profile: CuantoCobroProfileInput): EquipmentSavingsBreakdown {
  const inventory = getInventory(profile);
  const renewalByCategory: Partial<Record<EquipmentRenewalCategoryId, number>> = {};
  let renewalMonthly = 0;

  const renewalCategories: EquipmentRenewalCategoryId[] = [
    "camera",
    "lenses",
    "memory-cards",
    "computer",
    "monitor",
    "storage-disks",
    "speedlight",
    "studio-flash",
    "aa-batteries",
  ];

  for (const categoryId of renewalCategories) {
    if (categoryId === "aa-batteries") {
      const speedlight = inventory.renewal.speedlight;
      if (speedlight?.usesAABatteries !== "yes") continue;
    }
    const monthly = computeRenewalCategoryMonthly(categoryId, inventory);
    if (monthly !== null && monthly > 0) {
      renewalByCategory[categoryId] = monthly;
      renewalMonthly += monthly;
    }
  }

  const expansionByItem = inventory.futureEquipment
    .map((item) => {
      const price = parseCount(item.estimatedPrice);
      const months = timelineToMonths(item.desiredTimeline);
      if (price <= 0 || months === null) return null;
      return {
        id: item.id,
        name: item.name.trim() || "Equipo deseado",
        monthly: Math.round(price / months),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const expansionMonthly = expansionByItem.reduce((sum, item) => sum + item.monthly, 0);

  const usesLegacy = usesLegacyRenewalFallback(profile, inventory);
  if (usesLegacy) {
    renewalMonthly = parseCuantoCobroAmount(profile.equipmentRenewalMonthly) ?? 0;
  } else if (hasStructuredEquipmentData(inventory) && renewalMonthly > 0) {
    // Mantener campo legacy sincronizado para compatibilidad con lectores antiguos.
  }

  return {
    renewalMonthly,
    expansionMonthly,
    totalMonthly: renewalMonthly + expansionMonthly,
    renewalByCategory,
    expansionByItem,
    usesLegacyRenewalFallback: usesLegacy,
  };
}

export function getEffectiveRenewalMonthly(profile: CuantoCobroProfileInput): number {
  const savings = computeEquipmentSavings(profile);
  if (savings.usesLegacyRenewalFallback) {
    return savings.renewalMonthly;
  }
  if (hasStructuredEquipmentData(getInventory(profile))) {
    return savings.renewalMonthly;
  }
  return parseCuantoCobroAmount(profile.equipmentRenewalMonthly) ?? 0;
}

export function getEffectiveExpansionMonthly(profile: CuantoCobroProfileInput): number {
  return computeEquipmentSavings(profile).expansionMonthly;
}

export function getRenewalCategoryItemCount(
  categoryId: EquipmentRenewalCategoryId,
  inventory: CuantoCobroEquipmentInventory,
): number {
  switch (categoryId) {
    case "camera":
      return inventory.renewal.camera ? 1 : 0;
    case "lenses":
      return inventory.renewal.lenses.length;
    case "memory-cards":
      return inventory.renewal.memoryCards ? 1 : 0;
    case "computer":
      return inventory.renewal.computer ? 1 : 0;
    case "monitor":
      return inventory.renewal.monitor ? 1 : 0;
    case "storage-disks":
      return inventory.renewal.storageDisks ? 1 : 0;
    case "speedlight":
      return inventory.renewal.speedlight ? 1 : 0;
    case "studio-flash":
      return inventory.renewal.studioFlash ? 1 : 0;
    case "aa-batteries":
      return inventory.renewal.aaBatteries ? 1 : 0;
    default:
      return 0;
  }
}

export function isRenewalCategoryConfigured(
  categoryId: EquipmentRenewalCategoryId,
  inventory: CuantoCobroEquipmentInventory,
): boolean {
  if (categoryId === "aa-batteries") {
    return inventory.renewal.speedlight?.usesAABatteries === "yes" && Boolean(inventory.renewal.aaBatteries);
  }
  return getRenewalCategoryItemCount(categoryId, inventory) > 0;
}

export function buildRenewalCategoryCards(
  profile: CuantoCobroProfileInput,
): EquipmentCategoryCardMeta[] {
  const inventory = getInventory(profile);
  const categories: EquipmentRenewalCategoryId[] = [
    "camera",
    "lenses",
    "memory-cards",
    "computer",
    "monitor",
    "storage-disks",
    "speedlight",
    "studio-flash",
    "aa-batteries",
  ];

  return categories
    .filter((categoryId) => {
      if (categoryId === "aa-batteries") {
        return inventory.renewal.speedlight?.usesAABatteries === "yes";
      }
      return true;
    })
    .map((categoryId) => {
      const meta = RENEWAL_CATEGORY_META[categoryId];
      const itemCount = getRenewalCategoryItemCount(categoryId, inventory);
      const configured = isRenewalCategoryConfigured(categoryId, inventory);
      return {
        id: categoryId,
        title: meta.shortTitle,
        description: meta.description,
        status: configured ? "configured" : "pending",
        itemCount,
        monthlyContribution: computeRenewalCategoryMonthly(categoryId, inventory),
      };
    });
}

export function detectDuplicateCameraHint(profile: CuantoCobroProfileInput): string | null {
  const inventory = getInventory(profile);
  const hasRenewalCamera = Boolean(inventory.renewal.camera?.replacementValue?.trim());
  const hasFutureCamera = inventory.futureEquipment.some((item) => item.category === "camera");
  if (hasRenewalCamera && hasFutureCamera) {
    return "duplicate-camera";
  }
  return null;
}

export function estimateStorageNeedFromShots(annualShots: number): number {
  const storedPhotos = annualShots * 0.5;
  const bytes = storedPhotos * 20 * 1024 * 1024;
  return bytes / (1024 ** 4);
}

export function getAABatteryCount(inventory: CuantoCobroEquipmentInventory): number {
  const quantity = parseCount(inventory.renewal.speedlight?.quantity);
  if (quantity <= 0) return 0;
  return quantity * AA_BATTERIES_PER_SPEEDLIGHT;
}
