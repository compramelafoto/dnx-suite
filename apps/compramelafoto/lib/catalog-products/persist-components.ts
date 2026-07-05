import type { CatalogProductType } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import type { CatalogComponentInput } from "@/lib/catalog-products/components";
import {
  normalizeParsedComponents,
  parseComponentsPayload,
  replaceCatalogProductComponents,
  validateComponentsForProductType,
} from "@/lib/catalog-products/components";
import { catalogProductInclude } from "@/lib/catalog-products/product-include";
import { serializeCatalogProduct } from "@/lib/catalog-products/serialize";

export function bodyIncludesComponents(body: Record<string, unknown>): boolean {
  return body.components !== undefined;
}

export function resolveComponentsFromBody(
  body: Record<string, unknown>
): { ok: true; components: CatalogComponentInput[] } | { ok: false; error: string } {
  const parsed = normalizeParsedComponents(parseComponentsPayload(body.components));
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, components: parsed.components };
}

export function validateComponentsForType(
  type: CatalogProductType,
  components: CatalogComponentInput[]
): string | null {
  return validateComponentsForProductType(type, components);
}

export async function loadSerializedCatalogProduct(productId: number, userId: number) {
  const product = await prisma.catalogProduct.findFirst({
    where: { id: productId, userId },
    include: catalogProductInclude,
  });
  return product ? serializeCatalogProduct(product) : null;
}

export async function syncCatalogProductComponents(
  productId: number,
  components: CatalogComponentInput[]
) {
  await replaceCatalogProductComponents(prisma, productId, components);
}

export { replaceCatalogProductComponents };
