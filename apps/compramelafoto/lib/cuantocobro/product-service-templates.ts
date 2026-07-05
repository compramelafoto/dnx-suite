import { createEmptyQuoteItem, createQuoteItemId, itemToTemplateDefaults } from "@/lib/cuantocobro/quote-items";
import {
  createProductServiceTemplateId,
  enrichProductServiceTemplate,
} from "@/lib/cuantocobro/product-service-template-normalize";
import { getCuantoCobroStorage } from "@/lib/cuantocobro/storage/get-cuanto-cobro-storage";
import type {
  CuantoCobroProductServiceTemplate,
  CuantoCobroProductServiceTemplateValues,
  CuantoCobroQuoteItem,
  CuantoCobroQuoteItemTemplate,
} from "@/lib/cuantocobro/types";

function createTemplateId(): string {
  return createProductServiceTemplateId();
}

export function getTemplateEffectiveValues(
  template: CuantoCobroProductServiceTemplate,
): CuantoCobroProductServiceTemplateValues {
  return template.lastUsedValues ?? template.defaultValues;
}

export function recordProductServiceTemplateUsage(
  templates: CuantoCobroProductServiceTemplate[],
  templateId: string,
  item: CuantoCobroQuoteItem,
): CuantoCobroProductServiceTemplate[] {
  const now = new Date().toISOString();
  const lastUsedValues = itemToTemplateDefaults(item);

  return templates.map((template) =>
    template.id === templateId
      ? {
          ...template,
          lastUsedValues,
          lastUsedAt: now,
          usageCount: template.usageCount + 1,
          margin: item.desiredMarginPercent || template.margin,
          updatedAt: now,
        }
      : template,
  );
}

export function loadProductServiceTemplates(): CuantoCobroProductServiceTemplate[] {
  return getCuantoCobroStorage().loadProductServiceTemplates();
}

export function saveProductServiceTemplates(templates: CuantoCobroProductServiceTemplate[]): void {
  getCuantoCobroStorage().saveProductServiceTemplates(templates);
}

export function upsertProductServiceTemplate(
  templates: CuantoCobroProductServiceTemplate[],
  item: CuantoCobroQuoteItem,
  templateName: string,
  existingId?: string,
): CuantoCobroProductServiceTemplate[] {
  const trimmedName = templateName.trim();
  if (!trimmedName) return templates;

  const now = new Date().toISOString();
  const defaultValues = itemToTemplateDefaults(item);

  if (existingId) {
    return templates.map((template) =>
      template.id === existingId
        ? enrichProductServiceTemplate({
            ...template,
            name: trimmedName,
            type: item.itemType,
            description: item.description,
            defaultValues,
            margin: item.desiredMarginPercent,
            updatedAt: now,
          })
        : template,
    );
  }

  const next = enrichProductServiceTemplate({
    id: createTemplateId(),
    name: trimmedName,
    type: item.itemType,
    description: item.description,
    defaultValues,
    margin: item.desiredMarginPercent,
    createdAt: now,
    updatedAt: now,
  });

  return [next, ...templates];
}

export function deleteProductServiceTemplate(
  templates: CuantoCobroProductServiceTemplate[],
  templateId: string,
): CuantoCobroProductServiceTemplate[] {
  return templates.filter((template) => template.id !== templateId);
}

export function createQuoteItemFromProductServiceTemplate(
  template: CuantoCobroProductServiceTemplate,
): CuantoCobroQuoteItem {
  const effectiveValues = getTemplateEffectiveValues(template);

  return {
    ...createEmptyQuoteItem(),
    ...effectiveValues,
    id: createQuoteItemId(),
    libraryTemplateId: template.id,
    name: effectiveValues.name || template.defaultValues.name || template.name,
    description: effectiveValues.description || template.defaultValues.description || template.description,
    itemType: template.type,
    desiredMarginPercent: effectiveValues.desiredMarginPercent || template.margin,
  };
}

/** @deprecated Usar loadProductServiceTemplates */
export function loadQuoteItemTemplates(): CuantoCobroQuoteItemTemplate[] {
  return loadProductServiceTemplates().map((template) => ({
    id: template.id,
    templateName: template.name,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    defaults: template.defaultValues,
  }));
}

/** @deprecated Usar saveProductServiceTemplates */
export function saveQuoteItemTemplates(templates: CuantoCobroQuoteItemTemplate[]): void {
  saveProductServiceTemplates(
    templates.map((template) =>
      enrichProductServiceTemplate({
        id: template.id,
        name: template.templateName,
        type: template.defaults.itemType,
        description: template.defaults.description,
        defaultValues: itemToTemplateDefaults({ ...template.defaults, id: createQuoteItemId() }),
        margin: template.defaults.desiredMarginPercent,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      }),
    ),
  );
}

/** @deprecated Usar upsertProductServiceTemplate */
export function upsertQuoteItemTemplate(
  templates: CuantoCobroQuoteItemTemplate[],
  item: CuantoCobroQuoteItem,
  templateName: string,
  existingId?: string,
): CuantoCobroQuoteItemTemplate[] {
  const migrated = templates.map((template) =>
    enrichProductServiceTemplate({
      id: template.id,
      name: template.templateName,
      type: template.defaults.itemType,
      description: template.defaults.description,
      defaultValues: itemToTemplateDefaults({ ...template.defaults, id: createQuoteItemId() }),
      margin: template.defaults.desiredMarginPercent,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    }),
  );
  const next = upsertProductServiceTemplate(migrated, item, templateName, existingId);
  return next.map((template) => ({
    id: template.id,
    templateName: template.name,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    defaults: template.defaultValues,
  }));
}

/** @deprecated Usar deleteProductServiceTemplate */
export function deleteQuoteItemTemplate(
  templates: CuantoCobroQuoteItemTemplate[],
  templateId: string,
): CuantoCobroQuoteItemTemplate[] {
  const migrated = templates.map((template) =>
    enrichProductServiceTemplate({
      id: template.id,
      name: template.templateName,
      type: template.defaults.itemType,
      description: template.defaults.description,
      defaultValues: itemToTemplateDefaults({ ...template.defaults, id: createQuoteItemId() }),
      margin: template.defaults.desiredMarginPercent,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    }),
  );
  const next = deleteProductServiceTemplate(migrated, templateId);
  return next.map((template) => ({
    id: template.id,
    templateName: template.name,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    defaults: template.defaultValues,
  }));
}

/** @deprecated Usar createQuoteItemFromProductServiceTemplate */
export function createQuoteItemFromTemplate(template: CuantoCobroQuoteItemTemplate): CuantoCobroQuoteItem {
  return createQuoteItemFromProductServiceTemplate(
    enrichProductServiceTemplate({
      id: template.id,
      name: template.templateName,
      type: template.defaults.itemType,
      description: template.defaults.description,
      defaultValues: itemToTemplateDefaults({ ...template.defaults, id: createQuoteItemId() }),
      margin: template.defaults.desiredMarginPercent,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    }),
  );
}
