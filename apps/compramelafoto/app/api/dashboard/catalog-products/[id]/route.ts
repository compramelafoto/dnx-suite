import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CatalogProductType } from "@/lib/prisma";
import { requireCatalogProductsPhase1Api } from "@/lib/catalog-products/api-guard";
import { replaceCatalogProductComponents } from "@/lib/catalog-products/components";
import {
  bodyIncludesComponents,
  loadSerializedCatalogProduct,
  resolveComponentsFromBody,
  validateComponentsForType,
} from "@/lib/catalog-products/persist-components";
import { catalogProductInclude } from "@/lib/catalog-products/product-include";
import { serializeCatalogProduct } from "@/lib/catalog-products/serialize";
import {
  parseBasePriceCents,
  parseCatalogProductType,
  parseDescription,
  parseProductName,
} from "@/lib/catalog-products/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadOwnedProduct(id: number, userId: number) {
  return prisma.catalogProduct.findFirst({
    where: { id, userId },
    include: catalogProductInclude,
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const guard = await requireCatalogProductsPhase1Api();
  if (guard.error) return guard.error;
  const user = guard.user!;

  const productId = parseInt((await Promise.resolve(params)).id, 10);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const product = await loadOwnedProduct(productId, user.id);
  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
  }

  return NextResponse.json(serializeCatalogProduct(product));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const guard = await requireCatalogProductsPhase1Api();
  if (guard.error) return guard.error;
  const user = guard.user!;

  const productId = parseInt((await Promise.resolve(params)).id, 10);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const existing = await prisma.catalogProduct.findFirst({
    where: { id: productId, userId: user.id },
    include: { components: { orderBy: { sortOrder: "asc" } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = parseProductName(body.name);
    if (!name) {
      return NextResponse.json({ error: "Nombre inválido." }, { status: 400 });
    }
    data.name = name;
  }

  let effectiveType: CatalogProductType = existing.type;
  if (body.type !== undefined) {
    const type = parseCatalogProductType(body.type);
    if (!type) {
      return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
    }
    data.type = type;
    effectiveType = type;
  }

  if (body.basePriceCents !== undefined || body.basePrice !== undefined) {
    const basePriceCents = parseBasePriceCents(body.basePriceCents ?? body.basePrice);
    if (basePriceCents == null) {
      return NextResponse.json({ error: "Precio base inválido." }, { status: 400 });
    }
    data.basePriceCents = basePriceCents;
  }

  if (body.description !== undefined) {
    data.description = parseDescription(body.description);
  }

  if (body.categoryId !== undefined) {
    const categoryId = parseInt(String(body.categoryId), 10);
    if (!Number.isFinite(categoryId)) {
      return NextResponse.json({ error: "Categoría inválida." }, { status: 400 });
    }
    const category = await prisma.catalogProductCategory.findFirst({
      where: { id: categoryId, userId: user.id },
    });
    if (!category) {
      return NextResponse.json({ error: "Categoría no encontrada." }, { status: 404 });
    }
    data.categoryId = categoryId;
  }

  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }

  if (body.isArchived !== undefined) {
    data.isArchived = Boolean(body.isArchived);
  }

  if (body.sortOrder !== undefined) {
    const sortOrder = parseInt(String(body.sortOrder), 10);
    if (Number.isFinite(sortOrder)) data.sortOrder = sortOrder;
  }

  let componentsToSave: import("@/lib/catalog-products/components").CatalogComponentInput[] | null =
    null;

  if (bodyIncludesComponents(body)) {
    const resolved = resolveComponentsFromBody(body);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    componentsToSave = resolved.components;
  } else if (body.type !== undefined) {
    componentsToSave = existing.components.map((c) => ({
      name: c.name,
      quantity: c.quantity,
      deliveryType: c.deliveryType,
      sortOrder: c.sortOrder,
      notes: c.notes,
    }));
  }

  if (componentsToSave !== null) {
    const typeError = validateComponentsForType(effectiveType, componentsToSave);
    if (typeError) {
      return NextResponse.json({ error: typeError }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.catalogProduct.update({
        where: { id: productId },
        data,
      });
    }
    if (componentsToSave !== null) {
      await replaceCatalogProductComponents(tx, productId, componentsToSave);
    }
  });

  const serialized = await loadSerializedCatalogProduct(productId, user.id);
  if (!serialized) {
    return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
  }

  return NextResponse.json(serialized);
}
