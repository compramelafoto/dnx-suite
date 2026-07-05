import {
  parseVersionedTemplatesStore,
  serializeVersionedTemplatesStore,
} from "../schema-version";
import type { WizardStorageAdapter } from "../wizard-storage-keys";

/** Debe coincidir con `CUANTO_COBRO_PRODUCT_SERVICE_TEMPLATES_KEY` en product-service-template-normalize.ts */
export const CUANTO_COBRO_PRODUCT_SERVICE_TEMPLATES_STORAGE_KEY =
  "cuantocobro:product-service-templates";

/** Debe coincidir con `CUANTO_COBRO_LEGACY_QUOTE_ITEM_TEMPLATES_KEY` en product-service-template-normalize.ts */
export const CUANTO_COBRO_LEGACY_QUOTE_ITEM_TEMPLATES_STORAGE_KEY =
  "cuantocobro:quote-item-templates";

function readTemplatesKey<T>(
  lowLevel: WizardStorageAdapter,
  key: string,
  normalize: (raw: unknown) => T | null,
): T[] {
  try {
    const raw = lowLevel.getLocalItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    const entries = parseVersionedTemplatesStore(parsed);
    return entries
      .map((entry) => normalize(entry))
      .filter((entry): entry is T => entry !== null);
  } catch {
    return [];
  }
}

export function loadProductServiceTemplatesFromStorage<T extends { id: string }>(
  lowLevel: WizardStorageAdapter,
  normalize: (raw: unknown) => T | null,
): T[] {
  const current = readTemplatesKey(lowLevel, CUANTO_COBRO_PRODUCT_SERVICE_TEMPLATES_STORAGE_KEY, normalize);
  if (current.length > 0) return current;

  const legacy = readTemplatesKey(
    lowLevel,
    CUANTO_COBRO_LEGACY_QUOTE_ITEM_TEMPLATES_STORAGE_KEY,
    normalize,
  ).map((template) =>
    template.id.startsWith("qt-")
      ? { ...template, id: template.id.replace(/^qt-/, "pst-") }
      : template,
  );

  if (legacy.length > 0) {
    saveProductServiceTemplatesToStorage(lowLevel, legacy);
  }

  return legacy;
}

export function saveProductServiceTemplatesToStorage<T>(
  lowLevel: WizardStorageAdapter,
  templates: T[],
): void {
  try {
    lowLevel.setLocalItem(
      CUANTO_COBRO_PRODUCT_SERVICE_TEMPLATES_STORAGE_KEY,
      serializeVersionedTemplatesStore(templates),
    );
  } catch {
    /* ignore quota errors */
  }
}
