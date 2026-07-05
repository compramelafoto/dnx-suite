import type { CatalogDeliveryType, CatalogProductType } from "@/lib/prisma";
import { CATALOG_DELIVERY_TYPE_LABELS } from "@/lib/catalog-products/components";
import {
  formatDigitalQuantitySummary,
  type CatalogDigitalQuantityMode,
} from "@/lib/catalog-products/digital-quantity-mode";

export type CompositionLine = {
  quantity: number;
  name: string;
  deliveryType: CatalogDeliveryType;
  digitalQuantityMode?: CatalogDigitalQuantityMode;
};

export function formatComponentLine(line: CompositionLine): string {
  const name = line.name.trim();
  const mode = line.digitalQuantityMode ?? "FIXED";
  const qtyLabel = formatDigitalQuantitySummary(line.quantity, mode, line.deliveryType);

  if (line.deliveryType === "DIGITAL" && mode !== "FIXED" && qtyLabel) {
    return name ? `${name} (${qtyLabel})` : qtyLabel;
  }

  const qty = line.quantity;
  if (qty === 1) return name;
  return `${qty} ${name}`;
}

export function buildCompositionSummary(
  type: CatalogProductType,
  components: CompositionLine[]
): string | null {
  if (components.length === 0) return null;

  if (type === "PACK" && components.length === 1) {
    return formatComponentLine(components[0]);
  }

  if (type === "PACK") {
    return components.map(formatComponentLine).join(" · ");
  }

  if (type === "COMBO") {
    const deliveryLabels = [
      ...new Set(components.map((c) => CATALOG_DELIVERY_TYPE_LABELS[c.deliveryType])),
    ];
    if (deliveryLabels.length >= 2 && deliveryLabels.length <= 4) {
      return deliveryLabels.join(" + ");
    }
    const n = components.length;
    return `${n} componente${n === 1 ? "" : "s"}`;
  }

  if (type === "SIMPLE" && components.length === 1) {
    return formatComponentLine(components[0]);
  }

  return components.map(formatComponentLine).join(" · ");
}

export function compositionSummaryOrFallback(
  type: CatalogProductType,
  components: CompositionLine[]
): string {
  const summary = buildCompositionSummary(type, components);
  if (summary) return summary;
  if (type === "PACK" || type === "COMBO") {
    return "Sin componentes definidos";
  }
  return "";
}
