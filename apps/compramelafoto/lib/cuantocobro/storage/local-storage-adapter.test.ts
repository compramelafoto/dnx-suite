import { describe, expect, it } from "vitest";
import {
  loadBusinessProfileFromStorage,
  saveBusinessProfileToStorage,
  CUANTO_COBRO_BUSINESS_PROFILE_STORAGE_KEY,
} from "./business-profile-blob-persistence";
import { LocalStorageWizardBlobStorage } from "./local-storage-wizard-blob-storage";
import {
  loadProductServiceTemplatesFromStorage,
  saveProductServiceTemplatesToStorage,
  CUANTO_COBRO_PRODUCT_SERVICE_TEMPLATES_STORAGE_KEY,
  CUANTO_COBRO_LEGACY_QUOTE_ITEM_TEMPLATES_STORAGE_KEY,
} from "./templates-blob-persistence";
import {
  getWizardProfileStorageKey,
  WIZARD_LEGACY_PROFILE_KEY,
  WIZARD_LEGACY_QUOTE_KEY,
  type WizardStorageAdapter,
} from "../wizard-storage-keys";

type TestTemplate = { id: string; name: string };

function normalizeTestTemplate(raw: unknown): TestTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { id?: string; name?: string; templateName?: string };
  const name = row.name ?? row.templateName;
  if (typeof name !== "string" || !name.trim()) return null;
  return {
    id: typeof row.id === "string" ? row.id : "pst-unknown",
    name,
  };
}
type TestProfile = { currency: string; weeklyHours?: string };
type TestQuote = { client: { name: string } };

const emptyProfile: TestProfile = { currency: "" };
const emptyQuote: TestQuote = { client: { name: "" } };

function normalizeTestProfile(raw: unknown): TestProfile {
  const row = raw as Partial<TestProfile>;
  return {
    currency: typeof row.currency === "string" ? row.currency : "",
    weeklyHours: typeof row.weeklyHours === "string" ? row.weeklyHours : undefined,
  };
}

function normalizeTestQuote(raw: unknown): TestQuote {
  const row = raw as { client?: { name?: string } };
  return { client: { name: row.client?.name ?? "" } };
}

function createMockLowLevel(
  initial: {
    local?: Record<string, string>;
    session?: Record<string, string>;
  } = {},
): WizardStorageAdapter & { local: Record<string, string>; session: Record<string, string> } {
  const local = { ...initial.local };
  const session = { ...initial.session };

  return {
    local,
    session,
    getLocalItem: (key) => (key in local ? local[key] : null),
    setLocalItem: (key, value) => {
      local[key] = value;
    },
    getSessionItem: (key) => (key in session ? session[key] : null),
  };
}

function createWizardStorage(
  lowLevel: WizardStorageAdapter,
  userId: number | null,
): LocalStorageWizardBlobStorage<TestProfile, TestQuote> {
  return new LocalStorageWizardBlobStorage(lowLevel, () => userId, {
    normalizeProfile: normalizeTestProfile,
    normalizeQuote: normalizeTestQuote,
    initialProfile: emptyProfile,
    initialQuote: emptyQuote,
  });
}

describe("CuantoCobroStorageAdapter (LocalStorage implementation)", () => {
  it("carga profile desde sessionStorage legacy y migra a localStorage namespaced", () => {
    const lowLevel = createMockLowLevel({
      session: {
        [WIZARD_LEGACY_PROFILE_KEY]: JSON.stringify({ currency: "ARS", weeklyHours: "30" }),
      },
    });
    const storage = createWizardStorage(lowLevel, 12);

    const profile = storage.loadProfile();

    expect(profile.currency).toBe("ARS");
    expect(profile.weeklyHours).toBe("30");

    const namespacedKey = getWizardProfileStorageKey(12);
    expect(lowLevel.local[namespacedKey]).toBeTruthy();
    expect(JSON.parse(lowLevel.local[namespacedKey]).schemaVersion).toBe(1);
    expect(lowLevel.session[WIZARD_LEGACY_PROFILE_KEY]).toContain("ARS");
  });

  it("prefiere profile namespaced sobre session legacy", () => {
    const lowLevel = createMockLowLevel({
      local: {
        [getWizardProfileStorageKey(3)]: JSON.stringify({ currency: "USD", schemaVersion: 1 }),
      },
      session: {
        [WIZARD_LEGACY_PROFILE_KEY]: JSON.stringify({ currency: "ARS" }),
      },
    });
    const storage = createWizardStorage(lowLevel, 3);

    expect(storage.loadProfile().currency).toBe("USD");
  });

  it("saveProfile escribe schemaVersion en clave namespaced", () => {
    const lowLevel = createMockLowLevel();
    const storage = createWizardStorage(lowLevel, 8);

    storage.saveProfile({ currency: "ARS", weeklyHours: "40" });

    const raw = lowLevel.local[getWizardProfileStorageKey(8)];
    expect(JSON.parse(raw).schemaVersion).toBe(1);
    expect(JSON.parse(raw).weeklyHours).toBe("40");
  });

  it("fallback sin userId migra quote de session a localStorage legacy", () => {
    const lowLevel = createMockLowLevel({
      session: {
        [WIZARD_LEGACY_QUOTE_KEY]: JSON.stringify({ client: { name: "Ana" } }),
      },
    });
    const storage = createWizardStorage(lowLevel, null);

    expect(storage.loadQuote().client.name).toBe("Ana");
    expect(lowLevel.local[WIZARD_LEGACY_QUOTE_KEY]).toBeTruthy();
    expect(JSON.parse(lowLevel.local[WIZARD_LEGACY_QUOTE_KEY]).schemaVersion).toBe(1);
  });

  it("business profile respeta schemaVersion al guardar", () => {
    const lowLevel = createMockLowLevel();
    const normalizers = {
      normalize: (raw: { tradeName?: string }) => ({
        tradeName: raw.tradeName ?? "",
        photographerFirstName: "",
        photographerLastName: "",
        commercialEmail: "",
        phone: "",
        website: "",
        instagram: "",
        cuit: "",
        taxCondition: "",
        country: "",
        province: "",
        city: "",
        address: "",
        postalCode: "",
        latitude: "",
        longitude: "",
        logoUrl: "",
        updatedAt: "",
      }),
      hasContent: (p: { tradeName: string }) => Boolean(p.tradeName.trim()),
    };

    saveBusinessProfileToStorage(
      lowLevel,
      { ...normalizers.normalize({ tradeName: "Estudio" }), updatedAt: "" },
      normalizers,
    );

    const parsed = JSON.parse(lowLevel.local[CUANTO_COBRO_BUSINESS_PROFILE_STORAGE_KEY]);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.tradeName).toBe("Estudio");

    const loaded = loadBusinessProfileFromStorage(lowLevel, normalizers);
    expect(loaded?.tradeName).toBe("Estudio");
  });

  it("plantillas migran legacy array a envelope versionado", () => {
    const lowLevel = createMockLowLevel({
      local: {
        "cuantocobro:quote-item-templates": JSON.stringify([
          {
            id: "qt-1",
            templateName: "Sesión",
            defaults: {
              name: "Sesión",
              description: "",
              quantity: "1",
              itemType: "own-service",
              coverageHours: "",
              editingHours: "",
              selectionHours: "",
              deliveryHours: "",
              travelHours: "",
              administrationHours: "",
              salesHours: "",
              directCost: "",
              estimatedShots: "",
              supplierCost: "",
              productionHours: "",
              reviewHours: "",
              correctionHours: "",
              packagingCost: "",
              shippingCost: "",
              outsourcedLaborCost: "",
              managementHours: "",
              desiredMarginPercent: "",
              expenseCost: "",
            },
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        ]),
      },
    });

    const templates = loadProductServiceTemplatesFromStorage(lowLevel, normalizeTestTemplate);
    expect(templates).toHaveLength(1);
    expect(templates[0].id).toBe("pst-1");

    const stored = JSON.parse(lowLevel.local[CUANTO_COBRO_PRODUCT_SERVICE_TEMPLATES_STORAGE_KEY]);
    expect(stored.schemaVersion).toBe(1);
    expect(stored.templates).toHaveLength(1);
  });

  it("saveProductServiceTemplates persiste envelope con schemaVersion", () => {
    const lowLevel = createMockLowLevel();
    saveProductServiceTemplatesToStorage(lowLevel, [
      {
        id: "pst-9",
        name: "Pack",
        type: "own-service",
        description: "",
        defaultValues: {
          name: "Pack",
          description: "",
          quantity: "1",
          itemType: "own-service",
          coverageHours: "",
          editingHours: "",
          selectionHours: "",
          deliveryHours: "",
          travelHours: "",
          administrationHours: "",
          salesHours: "",
          directCost: "",
          estimatedShots: "",
          supplierCost: "",
          productionHours: "",
          reviewHours: "",
          correctionHours: "",
          packagingCost: "",
          shippingCost: "",
          outsourcedLaborCost: "",
          managementHours: "",
          desiredMarginPercent: "",
          expenseCost: "",
        },
        margin: "",
        lastUsedValues: null,
        lastUsedAt: null,
        usageCount: 0,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ]);

    const parsed = JSON.parse(lowLevel.local[CUANTO_COBRO_PRODUCT_SERVICE_TEMPLATES_STORAGE_KEY]);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.templates[0].id).toBe("pst-9");
  });

  it("normalizador de plantillas acepta formato legacy templateName", () => {
    const normalized = normalizeTestTemplate({
      id: "qt-1",
      templateName: "Sesión",
    });
    expect(normalized?.name).toBe("Sesión");
    expect(normalized?.id).toBe("qt-1");
  });
});
