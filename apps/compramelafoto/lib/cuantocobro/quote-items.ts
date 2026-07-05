import { parseCuantoCobroAmount } from "./amount-format";
import type { CuantoCobroQuoteItem, CuantoCobroQuoteItemType, CuantoCobroProductServiceTemplateValues } from "@/lib/cuantocobro/types";

export const QUOTE_ITEM_TYPE_LABELS: Record<CuantoCobroQuoteItemType, string> = {
  "own-service": "Servicio propio",
  "physical-product": "Producto físico",
  outsourced: "Trabajo tercerizado",
  expense: "Gasto / viático",
};

export const QUOTE_ITEM_PRESETS: { name: string; itemType: CuantoCobroQuoteItemType }[] = [
  { name: "Sesión de fotos", itemType: "own-service" },
  { name: "Cobertura de evento", itemType: "own-service" },
  { name: "Fotolibro", itemType: "physical-product" },
  { name: "Impresiones", itemType: "physical-product" },
  { name: "Cuadro", itemType: "physical-product" },
  { name: "Video", itemType: "outsourced" },
  { name: "Segundo fotógrafo", itemType: "outsourced" },
  { name: "Maquilladora", itemType: "outsourced" },
  { name: "Traslado", itemType: "expense" },
  { name: "Edición extra", itemType: "own-service" },
  { name: "Producto personalizado", itemType: "physical-product" },
];

export function createQuoteItemId(): string {
  return `qi-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyQuoteItem(
  overrides: Partial<CuantoCobroQuoteItem> = {},
): CuantoCobroQuoteItem {
  return {
    id: createQuoteItemId(),
    name: "",
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
    ...overrides,
  };
}

export function createQuoteItemFromPreset(presetName: string, itemType: CuantoCobroQuoteItemType): CuantoCobroQuoteItem {
  return createEmptyQuoteItem({ name: presetName, itemType });
}

export function duplicateQuoteItem(item: CuantoCobroQuoteItem): CuantoCobroQuoteItem {
  const { libraryTemplateId: _libraryTemplateId, ...rest } = item;
  return { ...rest, id: createQuoteItemId(), name: item.name ? `${item.name} (copia)` : "" };
}

export function parseQuoteItemQuantity(value: string): number {
  const parsed = parseCuantoCobroAmount(value);
  if (parsed === null || parsed <= 0) return 1;
  return parsed;
}

export function parseQuoteItemMargin(value: string): number {
  const parsed = parseCuantoCobroAmount(value);
  if (parsed === null || parsed < 0) return 0;
  return parsed;
}

export const QUOTE_ITEM_PHYSICAL_PRODUCT_MARGIN_LABEL = "Ganancia sobre este producto";
export const QUOTE_ITEM_PHYSICAL_PRODUCT_MARGIN_HINT =
  "Este porcentaje representa la ganancia que querés obtener sobre el costo del producto físico.";

export const QUOTE_ITEM_OUTSOURCED_MARGIN_LABEL = "Margen sobre el servicio tercerizado";
export const QUOTE_ITEM_OUTSOURCED_MARGIN_HINT =
  "Representa tu margen de coordinación y comercialización sobre un servicio realizado por un tercero.";

/**
 * Margen efectivo según tipo de ítem.
 * - Servicio propio: sin margen nuevo; solo se respeta % guardado en datos legacy.
 * - Producto físico / tercerizado: margen configurable.
 * - Gasto: solo recuperación, sin margen.
 */
export function getQuoteItemEffectiveMarginPercent(item: CuantoCobroQuoteItem): number {
  const parsed = parseQuoteItemMargin(item.desiredMarginPercent);

  switch (item.itemType) {
    case "own-service":
      return parsed > 0 ? parsed : 0;
    case "physical-product":
    case "outsourced":
      return parsed;
    case "expense":
      return 0;
    default:
      return 0;
  }
}

export function quoteItemTypeSupportsMarginField(itemType: CuantoCobroQuoteItemType): boolean {
  return itemType === "physical-product" || itemType === "outsourced";
}

export function computeQuoteItemPriceFromBaseCost(
  baseCost: number,
  item: CuantoCobroQuoteItem,
): { marginPercent: number; marginAmount: number; suggestedPrice: number } {
  const marginPercent = getQuoteItemEffectiveMarginPercent(item);
  const marginAmount = Math.round(baseCost * (marginPercent / 100));
  return {
    marginPercent,
    marginAmount,
    suggestedPrice: baseCost + marginAmount,
  };
}

export function parseQuoteItemHours(value: string): number {
  const parsed = parseCuantoCobroAmount(value);
  if (parsed === null || parsed < 0) return 0;
  return parsed;
}

/** Migra `selectionHours` legacy dentro de `editingHours` (postproducción unificada). */
export function consolidateOwnServicePostProductionHours(
  item: CuantoCobroQuoteItem,
): CuantoCobroQuoteItem {
  const selection = parseQuoteItemHours(item.selectionHours);
  if (selection <= 0) return item;

  const editing = parseQuoteItemHours(item.editingHours);
  const total = editing + selection;
  const rounded = Math.round(total * 100) / 100;
  const editingHours = Number.isInteger(rounded) ? String(rounded) : String(rounded);

  return { ...item, editingHours, selectionHours: "" };
}

export function normalizeQuoteItem(raw: Partial<CuantoCobroQuoteItem>): CuantoCobroQuoteItem {
  const base = createEmptyQuoteItem();
  const legacyCoverage = raw.coverageHours?.trim()
    ? raw.coverageHours
    : raw.ownWorkHours?.trim()
      ? raw.ownWorkHours
      : base.coverageHours;

  return consolidateOwnServicePostProductionHours({
    ...base,
    ...raw,
    id: typeof raw.id === "string" && raw.id ? raw.id : createQuoteItemId(),
    quantity: raw.quantity?.trim() ? raw.quantity : "1",
    itemType: raw.itemType ?? base.itemType,
    coverageHours: legacyCoverage,
    editingHours: raw.editingHours ?? base.editingHours,
    selectionHours: raw.selectionHours ?? base.selectionHours,
    deliveryHours: raw.deliveryHours ?? base.deliveryHours,
    travelHours: raw.travelHours ?? base.travelHours,
    administrationHours: raw.administrationHours ?? base.administrationHours,
    salesHours: raw.salesHours ?? base.salesHours,
  });
}

export function getQuoteTotalEstimatedShots(items: CuantoCobroQuoteItem[]): number {
  return items.reduce((total, item) => {
    if (item.itemType !== "own-service") return total;
    const shots = parseCuantoCobroAmount(item.estimatedShots) ?? 0;
    if (shots <= 0) return total;
    return total + shots * parseQuoteItemQuantity(item.quantity);
  }, 0);
}

export function itemToTemplateDefaults(item: CuantoCobroQuoteItem): CuantoCobroProductServiceTemplateValues {
  const { id: _id, libraryTemplateId: _libraryTemplateId, ...defaults } = item;
  return defaults;
}
