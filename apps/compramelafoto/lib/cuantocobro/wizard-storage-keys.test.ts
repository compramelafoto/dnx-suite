import { describe, expect, it } from "vitest";
import {
  getWizardProfileStorageKey,
  getWizardQuoteStorageKey,
  resolveWizardBlobRaw,
  WIZARD_LEGACY_PROFILE_KEY,
  WIZARD_LEGACY_QUOTE_KEY,
  type WizardStorageAdapter,
} from "./wizard-storage-keys";

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

describe("wizard-storage-keys", () => {
  it("genera claves namespaced con userId", () => {
    expect(getWizardProfileStorageKey(42)).toBe("cuantocobro:42:profile");
    expect(getWizardQuoteStorageKey(42)).toBe("cuantocobro:42:quote");
  });

  it("usa fallback sin userId", () => {
    expect(getWizardProfileStorageKey(null)).toBe(WIZARD_LEGACY_PROFILE_KEY);
    expect(getWizardQuoteStorageKey(undefined)).toBe(WIZARD_LEGACY_QUOTE_KEY);
  });

  it("carga desde sessionStorage legacy", () => {
    const adapter = createMockAdapter({
      session: { [WIZARD_LEGACY_PROFILE_KEY]: '{"currency":"ARS","schemaVersion":1}' },
    });

    const result = resolveWizardBlobRaw(adapter, 7, "profile");
    expect(result?.source).toBe("session");
    expect(result?.raw).toContain("ARS");
  });

  it("migra lectura legacy hacia clave namespaced al persistir (simulado)", () => {
    const adapter = createMockAdapter({
      session: { [WIZARD_LEGACY_QUOTE_KEY]: '{"client":{"name":"Ana"},"schemaVersion":1}' },
    });

    const loaded = resolveWizardBlobRaw(adapter, 99, "quote");
    expect(loaded?.source).toBe("session");

    adapter.setLocalItem(
      getWizardQuoteStorageKey(99),
      '{"client":{"name":"Ana"},"schemaVersion":1}',
    );

    expect(adapter.local[getWizardQuoteStorageKey(99)]).toContain("Ana");
    expect(adapter.session[WIZARD_LEGACY_QUOTE_KEY]).toContain("Ana");
  });

  it("prefiere clave namespaced si existe", () => {
    const adapter = createMockAdapter({
      local: {
        "cuantocobro:5:profile": '{"currency":"USD","schemaVersion":1}',
        [WIZARD_LEGACY_PROFILE_KEY]: '{"currency":"ARS","schemaVersion":1}',
      },
      session: {
        [WIZARD_LEGACY_PROFILE_KEY]: '{"currency":"EUR","schemaVersion":1}',
      },
    });

    const result = resolveWizardBlobRaw(adapter, 5, "profile");
    expect(result?.source).toBe("namespaced-local");
    expect(result?.raw).toContain("USD");
  });

  it("fallback sin userId lee localStorage legacy antes que session", () => {
    const adapter = createMockAdapter({
      local: { [WIZARD_LEGACY_PROFILE_KEY]: '{"currency":"LOCAL","schemaVersion":1}' },
      session: { [WIZARD_LEGACY_PROFILE_KEY]: '{"currency":"SESSION","schemaVersion":1}' },
    });

    const result = resolveWizardBlobRaw(adapter, null, "profile");
    expect(result?.source).toBe("namespaced-local");
    expect(result?.raw).toContain("LOCAL");
  });
});
