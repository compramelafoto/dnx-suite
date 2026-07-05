import type { CatalogDeliveryType, CatalogProductType } from "@/lib/prisma";
import type { Prisma } from "@/lib/prisma";
import {
  encodeNotesWithDigitalQty,
  normalizeDigitalQuantityForStorage,
  parseDigitalQuantityMode,
  resolveDigitalQuantityMode,
  stripDigitalQtyFromNotes,
  type CatalogDigitalQuantityMode,
} from "@/lib/catalog-products/digital-quantity-mode";

export const CATALOG_DELIVERY_TYPES: CatalogDeliveryType[] = [
  "DIGITAL",
  "IMPRESO",
  "MIXTO",
  "DISEÑO",
  "MANUAL",
];

export const CATALOG_DELIVERY_TYPE_LABELS: Record<CatalogDeliveryType, string> = {
  DIGITAL: "Digital",
  IMPRESO: "Impreso",
  MIXTO: "Mixto",
  DISEÑO: "Diseño",
  MANUAL: "Manual",
};

export type CatalogComponentInput = {
  name: string;
  quantity: number;
  deliveryType: CatalogDeliveryType;
  sortOrder: number;
  notes: string;
  digitalQuantityMode?: CatalogDigitalQuantityMode;
};

export type { CatalogDigitalQuantityMode };

export type CatalogComponentPayload = {
  name?: string;
  quantity?: number;
  deliveryType?: string;
  sortOrder?: number;
  notes?: string | null;
  digitalQuantityMode?: string;
};

export function parseDeliveryType(raw: unknown): CatalogDeliveryType | null {
  const s = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (CATALOG_DELIVERY_TYPES.includes(s as CatalogDeliveryType)) {
    return s as CatalogDeliveryType;
  }
  return null;
}

export function parseComponentPayload(raw: unknown, index: number): CatalogComponentInput | string {
  if (!raw || typeof raw !== "object") {
    return `Componente ${index + 1}: datos inválidos.`;
  }
  const row = raw as CatalogComponentPayload;
  const name = typeof row.name === "string" ? row.name.trim().slice(0, 200) : "";
  if (!name) return `Componente ${index + 1}: el nombre es obligatorio.`;

  const deliveryType = parseDeliveryType(row.deliveryType);
  if (!deliveryType) {
    return `Componente ${index + 1}: elegí un tipo de entrega válido.`;
  }

  const digitalQuantityMode = resolveDigitalQuantityMode({
    deliveryType,
    digitalQuantityMode: parseDigitalQuantityMode(row.digitalQuantityMode),
    notes: typeof row.notes === "string" ? row.notes : "",
  });

  const qtyRaw = row.quantity;
  const quantityParsed =
    typeof qtyRaw === "number" && Number.isFinite(qtyRaw)
      ? Math.round(qtyRaw)
      : parseInt(String(qtyRaw ?? ""), 10);

  if (digitalQuantityMode === "FIXED") {
    if (!Number.isFinite(quantityParsed) || quantityParsed < 1) {
      return `Componente ${index + 1}: la cantidad debe ser mayor a cero.`;
    }
  }

  const quantity = normalizeDigitalQuantityForStorage(
    Number.isFinite(quantityParsed) ? quantityParsed : 1,
    digitalQuantityMode
  );

  const sortOrder =
    typeof row.sortOrder === "number" && Number.isFinite(row.sortOrder)
      ? Math.round(row.sortOrder)
      : index;

  const notes =
    typeof row.notes === "string" ? row.notes.trim().slice(0, 500) : "";

  const notesOut = encodeNotesWithDigitalQty(notes, digitalQuantityMode);

  return {
    name,
    quantity,
    deliveryType,
    sortOrder,
    notes: notesOut,
    digitalQuantityMode,
  };
}

export function parseComponentsPayload(raw: unknown): CatalogComponentInput[] | string {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return "Los componentes deben enviarse como una lista.";
  const out: CatalogComponentInput[] = [];
  for (let i = 0; i < raw.length; i++) {
    const parsed = parseComponentPayload(raw[i], i);
    if (typeof parsed === "string") return parsed;
    out.push(parsed);
  }
  return out;
}

/** Normaliza errores de parseComponentsPayload. */
export function normalizeParsedComponents(
  parsed: CatalogComponentInput[] | string
): { ok: true; components: CatalogComponentInput[] } | { ok: false; error: string } {
  if (typeof parsed === "string") return { ok: false, error: parsed };
  const components = parsed.map((c, i) => ({ ...c, sortOrder: i }));
  return { ok: true, components };
}

export function validateComponentsForProductType(
  type: CatalogProductType,
  components: CatalogComponentInput[]
): string | null {
  if (type === "SIMPLE") {
    if (components.length > 1) {
      return "Un producto simple puede tener como máximo un componente.";
    }
    return null;
  }
  if (type === "PACK") {
    if (components.length < 1) {
      return "Un pack debe incluir al menos un componente (qué incluye el pack).";
    }
    return null;
  }
  if (type === "COMBO") {
    if (components.length < 2) {
      return "Un combo debe incluir al menos dos componentes.";
    }
    return null;
  }
  return null;
}

export async function replaceCatalogProductComponents(
  tx: Prisma.TransactionClient,
  productId: number,
  components: CatalogComponentInput[]
) {
  await tx.catalogProductComponent.deleteMany({ where: { productId } });
  if (components.length === 0) return;
  await tx.catalogProductComponent.createMany({
    data: components.map((c, i) => {
      const mode = resolveDigitalQuantityMode({
        deliveryType: c.deliveryType,
        digitalQuantityMode: c.digitalQuantityMode,
        notes: c.notes,
      });
      return {
        productId,
        name: c.name,
        quantity: c.quantity,
        deliveryType: c.deliveryType,
        sortOrder: i,
        notes: encodeNotesWithDigitalQty(stripDigitalQtyFromNotes(c.notes), mode),
      };
    }),
  });
}
