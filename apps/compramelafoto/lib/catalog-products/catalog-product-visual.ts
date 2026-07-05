import type { CatalogProductType } from "@/lib/prisma";

/** Etiquetas comerciales en UI (nunca «Simple»). */
export const CATALOG_PRODUCT_TYPE_DISPLAY: Record<CatalogProductType, string> = {
  SIMPLE: "Producto",
  PACK: "Pack",
  COMBO: "Combo",
};

export const CATALOG_PRODUCT_TYPE_STYLES: Record<
  CatalogProductType,
  { badge: string; placeholderGradient: string; placeholderIcon: string }
> = {
  SIMPLE: {
    badge: "bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]",
    placeholderGradient: "from-[#1e3a5f] via-[#2563eb] to-[#93c5fd]",
    placeholderIcon: "📷",
  },
  PACK: {
    badge: "bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa]",
    placeholderGradient: "from-[#422006] via-[#c27b3d] to-[#fcd34d]",
    placeholderIcon: "✨",
  },
  COMBO: {
    badge: "bg-[#f5f3ff] text-[#6d28d9] border border-[#ddd6fe]",
    placeholderGradient: "from-[#4c1d95] via-[#7c3aed] to-[#c4b5fd]",
    placeholderIcon: "⭐",
  },
};

export type CatalogProductStatusId = "active" | "inactive" | "archived";

export function getCatalogProductStatus(product: {
  isActive: boolean;
  isArchived: boolean;
}): CatalogProductStatusId {
  if (product.isArchived) return "archived";
  if (!product.isActive) return "inactive";
  return "active";
}

export const CATALOG_PRODUCT_STATUS_STYLES: Record<
  CatalogProductStatusId,
  { label: string; className: string; dot: string }
> = {
  active: {
    label: "Activo",
    className: "bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]",
    dot: "bg-[#10b981]",
  },
  inactive: {
    label: "Inactivo",
    className: "bg-[#fffbeb] text-[#b45309] border border-[#fde68a]",
    dot: "bg-[#f59e0b]",
  },
  archived: {
    label: "Archivado",
    className: "bg-[#f3f4f6] text-[#4b5563] border border-[#e5e7eb]",
    dot: "bg-[#9ca3af]",
  },
};
