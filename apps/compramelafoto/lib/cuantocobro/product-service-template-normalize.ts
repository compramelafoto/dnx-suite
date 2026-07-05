import { createEmptyQuoteItem, createQuoteItemId, itemToTemplateDefaults } from "./quote-items";
import type {
  CuantoCobroProductServiceTemplate,
  CuantoCobroQuoteItem,
  CuantoCobroQuoteItemTemplate,
} from "./types";

export const CUANTO_COBRO_PRODUCT_SERVICE_TEMPLATES_KEY = "cuantocobro:product-service-templates";
export const CUANTO_COBRO_LEGACY_QUOTE_ITEM_TEMPLATES_KEY = "cuantocobro:quote-item-templates";

export function createProductServiceTemplateId(): string {
  return `pst-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function enrichProductServiceTemplate(
  template: Omit<CuantoCobroProductServiceTemplate, "lastUsedValues" | "lastUsedAt" | "usageCount"> &
    Partial<Pick<CuantoCobroProductServiceTemplate, "lastUsedValues" | "lastUsedAt" | "usageCount">>,
): CuantoCobroProductServiceTemplate {
  return {
    ...template,
    lastUsedValues: template.lastUsedValues ?? null,
    lastUsedAt: template.lastUsedAt ?? null,
    usageCount: template.usageCount ?? 0,
  };
}

function migrateLegacyTemplate(template: CuantoCobroQuoteItemTemplate): CuantoCobroProductServiceTemplate {
  return enrichProductServiceTemplate({
    id: template.id.startsWith("qt-") ? template.id.replace(/^qt-/, "pst-") : template.id,
    name: template.templateName,
    type: template.defaults.itemType,
    description: template.defaults.description,
    defaultValues: itemToTemplateDefaults({ ...template.defaults, id: createQuoteItemId() }),
    margin: template.defaults.desiredMarginPercent,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  });
}

export function normalizeStoredProductServiceTemplate(
  raw: unknown,
): CuantoCobroProductServiceTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<CuantoCobroProductServiceTemplate> & {
    templateName?: string;
    defaults?: Omit<CuantoCobroQuoteItem, "id">;
  };

  if (row.templateName && row.defaults) {
    return migrateLegacyTemplate({
      id: typeof row.id === "string" ? row.id : createProductServiceTemplateId(),
      templateName: row.templateName,
      defaults: row.defaults,
      createdAt: row.createdAt ?? new Date().toISOString(),
      updatedAt: row.updatedAt ?? new Date().toISOString(),
    });
  }

  if (!row.defaultValues || typeof row.name !== "string" || !row.type) return null;

  return enrichProductServiceTemplate({
    id: typeof row.id === "string" ? row.id : createProductServiceTemplateId(),
    name: row.name,
    type: row.type,
    description: row.description ?? row.defaultValues.description ?? "",
    defaultValues: row.defaultValues,
    margin: row.margin ?? row.defaultValues.desiredMarginPercent ?? "",
    lastUsedValues: row.lastUsedValues ?? null,
    lastUsedAt: row.lastUsedAt ?? null,
    usageCount: typeof row.usageCount === "number" ? row.usageCount : 0,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  });
}
