import type { CatalogDeliveryType } from "@/lib/prisma";
import { CATALOG_DELIVERY_TYPES } from "@/lib/catalog-products/components";
import type { CatalogComponentInput } from "@/lib/catalog-products/components";
import {
  parseDigitalQuantityMode,
  resolveDigitalQuantityMode,
  stripDigitalQtyFromNotes,
  type CatalogDigitalQuantityMode,
} from "@/lib/catalog-products/digital-quantity-mode";

export type StoredTemplateComponent = {
  name: string;
  quantity: number;
  deliveryType: CatalogDeliveryType;
  sortOrder: number;
  notes?: string;
  digitalQuantityMode?: CatalogDigitalQuantityMode;
};

export function parseTemplateComponents(raw: unknown): StoredTemplateComponent[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredTemplateComponent[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) continue;
    const quantity =
      typeof item.quantity === "number" && Number.isFinite(item.quantity)
        ? Math.max(1, Math.round(item.quantity))
        : 1;
    const deliveryRaw = typeof item.deliveryType === "string" ? item.deliveryType.toUpperCase() : "";
    const deliveryType = CATALOG_DELIVERY_TYPES.includes(deliveryRaw as CatalogDeliveryType)
      ? (deliveryRaw as CatalogDeliveryType)
      : "DIGITAL";
    const sortOrder =
      typeof item.sortOrder === "number" && Number.isFinite(item.sortOrder)
        ? Math.round(item.sortOrder)
        : i;
    const notes = typeof item.notes === "string" ? item.notes.trim() : "";
    const digitalQuantityMode = resolveDigitalQuantityMode({
      deliveryType,
      digitalQuantityMode: parseDigitalQuantityMode(item.digitalQuantityMode),
      notes,
    });
    out.push({
      name,
      quantity,
      deliveryType,
      sortOrder,
      ...(notes ? { notes } : {}),
      ...(digitalQuantityMode !== "FIXED" ? { digitalQuantityMode } : {}),
    });
  }
  return out.sort((a, b) => a.sortOrder - b.sortOrder);
}

export function templateComponentsToCatalogInput(
  components: StoredTemplateComponent[]
): CatalogComponentInput[] {
  return components.map((c, i) => {
    const mode = resolveDigitalQuantityMode({
      deliveryType: c.deliveryType,
      digitalQuantityMode: c.digitalQuantityMode,
      notes: c.notes ?? "",
    });
    return {
      name: c.name,
      quantity: c.quantity,
      deliveryType: c.deliveryType,
      sortOrder: i,
      notes: stripDigitalQtyFromNotes(c.notes ?? ""),
      digitalQuantityMode: mode,
    };
  });
}
