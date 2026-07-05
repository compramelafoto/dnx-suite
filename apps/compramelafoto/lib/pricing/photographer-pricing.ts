import { prisma } from "@/lib/prisma";

type PricingResponse = {
  photographerId: number | null;
  photographerName: string | null;
  basePrices: Array<{ size: string; unitPrice: number }>;
  discounts: Array<{ size: string; minQty: number; discountPercent: number }>;
  products: Array<{
    id: number;
    name: string;
    size: string | null;
    acabado: string | null;
    retailPrice: number;
    isActive: boolean;
  }>;
};

export async function getPhotographerPricing(photographerId?: number | null): Promise<PricingResponse> {
  const prismaAny = prisma as any;
  if (!prismaAny.photographerProduct?.findMany) {
    return {
      photographerId: null,
      photographerName: null,
      basePrices: [],
      discounts: [],
      products: [],
    };
  }

  let resolvedPhotographerId = photographerId ?? null;

  if (!resolvedPhotographerId) {
    const firstWithProducts = await prismaAny.photographerProduct.findFirst({
      select: { userId: true },
      where: { isActive: true },
      orderBy: { id: "asc" },
    });
    resolvedPhotographerId = firstWithProducts?.userId ?? null;
  }

  if (!resolvedPhotographerId) {
    return {
      photographerId: null,
      photographerName: null,
      basePrices: [],
      discounts: [],
      products: [],
    };
  }

  const photographer = await prisma.user.findUnique({
    where: { id: resolvedPhotographerId },
    select: { id: true, name: true },
  });

  const products = await prismaAny.photographerProduct.findMany({
    where: { userId: resolvedPhotographerId },
    orderBy: [{ name: "asc" }, { size: "asc" }],
  });

  const activeProducts = (Array.isArray(products) ? products : []).filter((p: any) => p.isActive !== false);

  const baseBySize = new Map<string, number>();
  for (const product of activeProducts) {
    if (!product.size) continue;
    const priceToUse = Number(product.retailPrice ?? 0);
    if (!Number.isFinite(priceToUse) || priceToUse <= 0) continue;
    const existing = baseBySize.get(product.size);
    if (!existing || priceToUse < existing) {
      baseBySize.set(product.size, priceToUse);
    }
  }

  const basePrices = Array.from(baseBySize.entries()).map(([size, unitPrice]) => ({
    size,
    unitPrice: Math.round(unitPrice),
  }));

  return {
    photographerId: photographer?.id ?? resolvedPhotographerId,
    photographerName: photographer?.name ?? null,
    basePrices,
    discounts: [],
    products: activeProducts,
  };
}
