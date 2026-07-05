import { describe, expect, it } from "vitest";
import {
  EQUIPMENT_CATEGORY_FALLBACK_ICON,
  EQUIPMENT_RENEWAL_CATEGORY_IDS,
  getEquipmentCategoryIcon,
} from "./category-icons";
import {
  computeEquipmentSavings,
  computeRenewalCategoryMonthly,
  detectDuplicateCameraHint,
  estimateStorageNeedFromShots,
  getAABatteryCount,
} from "./calculations";
import { INITIAL_EQUIPMENT_INVENTORY, normalizeEquipmentInventory } from "./normalize";
import type { CuantoCobroProfileInput } from "../types";

function baseProfile(overrides: Partial<CuantoCobroProfileInput> = {}): CuantoCobroProfileInput {
  return {
    currency: "",
    livesOnlyFromPhotography: "",
    externalMonthlyIncome: "",
    personalExpenseGroups: [],
    businessRent: "",
    businessSoftware: "",
    businessMarketing: "",
    employeesCount: "",
    employeeMonthlyCost: "",
    weeklyHours: "",
    timeDistribution: {
      coverage: "",
      editing: "",
      administration: "",
      sales: "",
      marketing: "",
      training: "",
    },
    daysPerWeek: "",
    externalWorkSituation: "",
    externalWorkWeeklyHours: "",
    equipmentRenewalMonthly: "",
    primaryCameraPresetId: "",
    primaryCameraCustomName: "",
    primaryCameraShutterRating: "",
    primaryCameraCurrentShutterCount: "",
    primaryCameraReplacementValue: "",
    estimatedAnnualShots: "",
    emergencyFundMonthly: "",
    savingsGoalsMonthly: "",
    ...overrides,
  };
}

describe("equipment category icons", () => {
  it("resuelve un ícono válido para cada categoría de renovación", () => {
    for (const categoryId of EQUIPMENT_RENEWAL_CATEGORY_IDS) {
      const Icon = getEquipmentCategoryIcon(categoryId);
      expect(Icon).toBeTruthy();
      expect(Icon).not.toBe(EQUIPMENT_CATEGORY_FALLBACK_ICON);
    }
  });

  it("usa Package como fallback si la categoría no tiene ícono", () => {
    const Icon = getEquipmentCategoryIcon("nonexistent-category" as "camera");
    expect(Icon).toBe(EQUIPMENT_CATEGORY_FALLBACK_ICON);
  });
});

describe("equipment normalize", () => {
  it("migra datos legacy de cámara sin perderlos", () => {
    const legacy = baseProfile({
      primaryCameraPresetId: "sony-a7iv",
      primaryCameraReplacementValue: "2000000",
      primaryCameraShutterRating: "200000",
      primaryCameraCurrentShutterCount: "50000",
      estimatedAnnualShots: "60000",
    });

    const inventory = normalizeEquipmentInventory(undefined, legacy);
    expect(inventory.renewal.camera).not.toBeNull();
    expect(inventory.renewal.camera?.presetId).toBe("sony-a7iv");
    expect(inventory.renewal.camera?.replacementValue).toBe("2000000");
    expect(inventory.renewal.camera?.currentShutterCount).toBe("50000");
  });

  it("conserva equipmentRenewalMonthly legacy cuando no hay inventario estructurado", () => {
    const profile = baseProfile({ equipmentRenewalMonthly: "75000" });
    const savings = computeEquipmentSavings(profile);
    expect(savings.usesLegacyRenewalFallback).toBe(true);
    expect(savings.renewalMonthly).toBe(75000);
    expect(savings.expansionMonthly).toBe(0);
  });
});

describe("equipment calculations", () => {
  it("calcula cámara por disparos restantes", () => {
    const inventory = normalizeEquipmentInventory(
      {
        renewal: {
          ...INITIAL_EQUIPMENT_INVENTORY.renewal,
          camera: {
            presetId: "custom",
            customName: "Test",
            shutterRating: "300000",
            currentShutterCount: "100000",
            replacementValue: "3000000",
            resaleValue: "500000",
            estimatedAnnualShots: "120000",
          },
        },
        futureEquipment: [],
      },
      {},
    );

    const monthly = computeRenewalCategoryMonthly("camera", inventory);
    expect(monthly).not.toBeNull();
    expect(monthly).toBeGreaterThan(0);
    // net 2.5M, remaining 200k shots, 10k shots/month => 20 months => 125000/mes
    expect(monthly).toBe(125000);
  });

  it("usa vida útil de 10 años para lentes", () => {
    const inventory = normalizeEquipmentInventory(
      {
        renewal: {
          ...INITIAL_EQUIPMENT_INVENTORY.renewal,
          lenses: [
            {
              id: "l1",
              model: "50mm",
              replacementValue: "1200000",
              yearsOwned: "0",
              resaleValue: "",
            },
          ],
        },
        futureEquipment: [],
      },
      {},
    );

    const monthly = computeRenewalCategoryMonthly("lenses", inventory);
    expect(monthly).toBe(10000);
  });

  it("recomienda una tarjeta cada 6 meses", () => {
    const inventory = normalizeEquipmentInventory(
      {
        renewal: {
          ...INITIAL_EQUIPMENT_INVENTORY.renewal,
          memoryCards: { quantity: "4", averagePrice: "60000" },
        },
        futureEquipment: [],
      },
      {},
    );

    expect(computeRenewalCategoryMonthly("memory-cards", inventory)).toBe(10000);
  });

  it("usa 5 años para computadora", () => {
    const inventory = normalizeEquipmentInventory(
      {
        renewal: {
          ...INITIAL_EQUIPMENT_INVENTORY.renewal,
          computer: { replacementValue: "1800000", yearsOwned: "0" },
        },
        futureEquipment: [],
      },
      {},
    );

    expect(computeRenewalCategoryMonthly("computer", inventory)).toBe(30000);
  });

  it("separa renovación y ampliación", () => {
    const profile = baseProfile({
      equipmentInventory: normalizeEquipmentInventory(
        {
          renewal: {
            ...INITIAL_EQUIPMENT_INVENTORY.renewal,
            computer: { replacementValue: "1200000", yearsOwned: "0" },
          },
          futureEquipment: [
            {
              id: "f1",
              purpose: "FUTURE_EXPANSION_EQUIPMENT",
              category: "drone",
              name: "Drone",
              estimatedPrice: "2400000",
              desiredTimeline: "2",
              note: "",
            },
          ],
        },
        {},
      ),
    });

    const savings = computeEquipmentSavings(profile);
    expect(savings.renewalMonthly).toBe(20000);
    expect(savings.expansionMonthly).toBe(100000);
    expect(savings.totalMonthly).toBe(120000);
    expect(savings.renewalByCategory.computer).toBe(20000);
    expect(savings.expansionByItem).toHaveLength(1);
  });

  it("detecta cámara en renovación y compra futura sin bloquear", () => {
    const profile = baseProfile({
      equipmentInventory: normalizeEquipmentInventory(
        {
          renewal: {
            ...INITIAL_EQUIPMENT_INVENTORY.renewal,
            camera: {
              presetId: "custom",
              customName: "Principal",
              shutterRating: "300000",
              currentShutterCount: "0",
              replacementValue: "2000000",
              resaleValue: "",
              estimatedAnnualShots: "",
            },
          },
          futureEquipment: [
            {
              id: "f1",
              purpose: "FUTURE_EXPANSION_EQUIPMENT",
              category: "camera",
              name: "Segunda cámara",
              estimatedPrice: "1500000",
              desiredTimeline: "1",
              note: "",
            },
          ],
        },
        {},
      ),
    });

    expect(detectDuplicateCameraHint(profile)).toBe("duplicate-camera");
  });

  it("calcula pilas AA según cantidad de speedlights", () => {
    const inventory = normalizeEquipmentInventory(
      {
        renewal: {
          ...INITIAL_EQUIPMENT_INVENTORY.renewal,
          speedlight: {
            quantity: "2",
            averagePrice: "200000",
            lifespanYears: "5",
            usesAABatteries: "yes",
          },
        },
        futureEquipment: [],
      },
      {},
    );

    expect(getAABatteryCount(inventory)).toBe(8);
  });

  it("estima almacenamiento futuro desde disparos", () => {
    const tb = estimateStorageNeedFromShots(1000);
    expect(tb).toBeGreaterThan(0);
  });

  it("conserva ítems futuros en borrador sin nombre ni precio", () => {
    const inventory = normalizeEquipmentInventory({
      futureEquipment: [
        {
          id: "future-draft-1",
          purpose: "FUTURE_EXPANSION_EQUIPMENT",
          category: "other",
          name: "",
          estimatedPrice: "",
          desiredTimeline: "",
          note: "",
        },
      ],
    });

    expect(inventory.futureEquipment).toHaveLength(1);
    expect(inventory.futureEquipment[0]?.id).toBe("future-draft-1");
  });
});
