import { CatalogProductType } from "@/lib/prisma";

const PRODUCT_TYPES = new Set<string>(["SIMPLE", "PACK", "COMBO"]);

export function parseCatalogProductType(raw: unknown): CatalogProductType | null {
  const s = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!PRODUCT_TYPES.has(s)) return null;
  return s as CatalogProductType;
}

export function parseBasePriceCents(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.round(raw);
    return n > 0 ? n : null;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim().replace(",", ".");
    if (!trimmed) return null;
    const pesos = parseFloat(trimmed);
    if (!Number.isFinite(pesos) || pesos <= 0) return null;
    return Math.round(pesos);
  }
  return null;
}

export function parseProductName(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s.length < 2) return null;
  return s.slice(0, 200);
}

export function parseDescription(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s.slice(0, 2000);
}
