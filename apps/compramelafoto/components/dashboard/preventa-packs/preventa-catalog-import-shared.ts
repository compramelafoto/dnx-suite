export type CatalogProductOption = {
  id: number;
  name: string;
  basePriceCents: number;
  compositionSummary: string;
  componentCount: number;
};

export type CatalogTemplateOption = {
  templateId: number;
  name: string;
  suggestedPriceCents: number | null;
  compositionSummary: string;
  componentCount: number;
};

export type CatalogIncompatibleOption = {
  id: number;
  name: string;
  compositionSummary: string;
  reason: "no_components" | "already_imported" | "inactive";
};

export type CatalogImportOptionsResponse = {
  photographerProducts: CatalogProductOption[];
  systemFromCatalog: CatalogProductOption[];
  systemTemplates: CatalogTemplateOption[];
  incompatible: CatalogIncompatibleOption[];
  compatibleCount?: number;
};

export type CatalogParsedSelection =
  | { kind: "product"; catalogProductId: number; label: string; basePriceCents: number }
  | { kind: "template"; templateId: number; label: string; suggestedPriceCents: number | null };

export const CATALOG_INCOMPATIBLE_REASON_LABEL: Record<
  CatalogIncompatibleOption["reason"],
  string
> = {
  no_components: "Falta definir componentes",
  already_imported: "Ya usado en esta preventa",
  inactive: "Producto inactivo",
};

export function formatCatalogOptionLabel(name: string, compositionSummary: string): string {
  if (!compositionSummary) return name;
  return `${name} — ${compositionSummary}`;
}

export function parseCatalogSelectionValue(
  raw: string,
  options: CatalogImportOptionsResponse | null
): CatalogParsedSelection | null {
  if (!raw || !options) return null;
  if (raw.startsWith("product:")) {
    const id = parseInt(raw.slice("product:".length), 10);
    const product = [...options.photographerProducts, ...options.systemFromCatalog].find(
      (p) => p.id === id
    );
    if (!product) return null;
    return {
      kind: "product",
      catalogProductId: product.id,
      label: product.name,
      basePriceCents: product.basePriceCents,
    };
  }
  if (raw.startsWith("template:")) {
    const templateId = parseInt(raw.slice("template:".length), 10);
    const template = options.systemTemplates.find((t) => t.templateId === templateId);
    if (!template) return null;
    return {
      kind: "template",
      templateId: template.templateId,
      label: template.name,
      suggestedPriceCents: template.suggestedPriceCents,
    };
  }
  return null;
}

export async function resolveCatalogProductIdForImport(
  parsed: CatalogParsedSelection
): Promise<number> {
  if (parsed.kind === "product") {
    return parsed.catalogProductId;
  }

  const cloneRes = await fetch(`/api/dashboard/catalog-templates/${parsed.templateId}/clone`, {
    method: "POST",
  });
  const cloneData = await cloneRes.json().catch(() => ({}));
  if (!cloneRes.ok) {
    throw new Error(
      typeof cloneData.error === "string"
        ? cloneData.error
        : "No se pudo agregar el pack recomendado a tu catálogo."
    );
  }

  const productId = Number(cloneData?.product?.id ?? cloneData?.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error("No se obtuvo el producto tras agregar el pack recomendado.");
  }

  const componentCount = Array.isArray(cloneData?.product?.components)
    ? cloneData.product.components.length
    : Number(cloneData?.product?.components?.length ?? 0);

  if (componentCount === 0) {
    throw new Error(
      "El pack recomendado no tiene componentos válidos. Elegí otro o completalo en Mis Packs y Combos."
    );
  }

  return productId;
}

export async function fetchCatalogImportOptions(
  albumId: number
): Promise<CatalogImportOptionsResponse> {
  const res = await fetch(
    `/api/dashboard/albums/${albumId}/preventa-packs/catalog-import-options`,
    { cache: "no-store" }
  );
  const data = (await res.json().catch(() => ({}))) as CatalogImportOptionsResponse & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data?.error || "No se pudieron cargar tus productos");
  }
  return data;
}
