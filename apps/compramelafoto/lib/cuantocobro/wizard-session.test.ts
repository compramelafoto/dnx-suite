import { describe, expect, it } from "vitest";
import { loadWizardDomainBlob, persistWizardDomainBlob } from "./wizard-blob-persistence";
import {
  getWizardProfileStorageKey,
  WIZARD_LEGACY_PROFILE_KEY,
  type WizardStorageAdapter,
} from "./wizard-storage-keys";

type TestProfile = {
  currency: string;
  weeklyHours?: string;
};

const emptyProfile: TestProfile = { currency: "" };

function normalizeTestProfile(raw: unknown): TestProfile {
  const row = raw as Partial<TestProfile>;
  return {
    currency: typeof row.currency === "string" ? row.currency : "",
    weeklyHours: typeof row.weeklyHours === "string" ? row.weeklyHours : undefined,
  };
}

function createMockAdapter(
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

describe("wizard-blob-persistence migration", () => {
  it("carga desde sessionStorage legacy y escribe en localStorage namespaced", () => {
    const adapter = createMockAdapter({
      session: {
        [WIZARD_LEGACY_PROFILE_KEY]: JSON.stringify({
          currency: "ARS",
          weeklyHours: "30",
        }),
      },
    });

    const result = loadWizardDomainBlob(
      adapter,
      12,
      "profile",
      normalizeTestProfile,
      emptyProfile,
    );

    expect(result.source).toBe("session");
    expect(result.migrated).toBe(true);
    expect(result.value.currency).toBe("ARS");
    expect(result.value.weeklyHours).toBe("30");

    const namespacedKey = getWizardProfileStorageKey(12);
    expect(adapter.local[namespacedKey]).toBeTruthy();
    expect(JSON.parse(adapter.local[namespacedKey]).schemaVersion).toBe(1);
    expect(adapter.session[WIZARD_LEGACY_PROFILE_KEY]).toContain("ARS");
  });

  it("prefiere namespaced local sobre session legacy", () => {
    const adapter = createMockAdapter({
      local: {
        [getWizardProfileStorageKey(3)]: JSON.stringify({
          currency: "USD",
          schemaVersion: 1,
        }),
      },
      session: {
        [WIZARD_LEGACY_PROFILE_KEY]: JSON.stringify({ currency: "ARS" }),
      },
    });

    const result = loadWizardDomainBlob(adapter, 3, "profile", normalizeTestProfile, emptyProfile);

    expect(result.source).toBe("namespaced-local");
    expect(result.migrated).toBe(false);
    expect(result.value.currency).toBe("USD");
  });

  it("fallback sin userId persiste en localStorage legacy", () => {
    const adapter = createMockAdapter({
      session: {
        [WIZARD_LEGACY_PROFILE_KEY]: JSON.stringify({ currency: "EUR" }),
      },
    });

    const result = loadWizardDomainBlob(adapter, null, "profile", normalizeTestProfile, emptyProfile);

    expect(result.migrated).toBe(true);
    expect(adapter.local[WIZARD_LEGACY_PROFILE_KEY]).toBeTruthy();
    expect(JSON.parse(adapter.local[WIZARD_LEGACY_PROFILE_KEY]).schemaVersion).toBe(1);
  });

  it("save escribe schemaVersion en localStorage namespaced", () => {
    const adapter = createMockAdapter();

    persistWizardDomainBlob(adapter, 8, "quote", {
      internalNotes: "borrador",
      client: { name: "Cliente" },
    });

    const raw = adapter.local["cuantocobro:8:quote"];
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.internalNotes).toBe("borrador");
  });
});
