import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CatalogProductType, Prisma } from "@/lib/prisma";
import { requireCatalogProductsPhase1Api } from "@/lib/catalog-products/api-guard";
import { serializeCatalogProduct } from "@/lib/catalog-products/serialize";
import {
  bodyIncludesComponents,
  resolveComponentsFromBody,
  validateComponentsForType,
} from "@/lib/catalog-products/persist-components";
import { replaceCatalogProductComponents } from "@/lib/catalog-products/components";
import type { CatalogComponentInput } from "@/lib/catalog-products/components";
import { catalogProductInclude } from "@/lib/catalog-products/product-include";
import {
  parseBasePriceCents,
  parseCatalogProductType,
  parseDescription,
  parseProductName,
} from "@/lib/catalog-products/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireCatalogProductsPhase1Api();
  if (guard.error) return guard.error;
  const user = guard.user!;

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") ?? "all";
  const q = (searchParams.get("q") ?? "").trim();
  const categoryIdRaw = searchParams.get("categoryId");
  const typeRaw = searchParams.get("type");

  const where: Prisma.CatalogProductWhereInput = { userId: user.id };

  if (view === "active") {
    where.isArchived = false;
    where.isActive = true;
  } else if (view === "archived") {
    where.isArchived = true;
  } else {
    where.isArchived = false;
  }

  if (categoryIdRaw) {
    const categoryId = parseInt(categoryIdRaw, 10);
    if (Number.isFinite(categoryId)) where.categoryId = categoryId;
  }

  if (typeRaw && ["SIMPLE", "PACK", "COMBO"].includes(typeRaw.toUpperCase())) {
    where.type = typeRaw.toUpperCase() as CatalogProductType;
  }

  if (q.length >= 1) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const [products, totalAll, totalActive, totalArchived] = await Promise.all([
    prisma.catalogProduct.findMany({
      where,
      include: catalogProductInclude,
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.catalogProduct.count({ where: { userId: user.id, isArchived: false } }),
    prisma.catalogProduct.count({
      where: { userId: user.id, isArchived: false, isActive: true },
    }),
    prisma.catalogProduct.count({ where: { userId: user.id, isArchived: true } }),
  ]);

  return NextResponse.json({
    products: products.map(serializeCatalogProduct),
    counts: {
      shown: products.length,
      all: totalAll,
      active: totalActive,
      archived: totalArchived,
    },
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireCatalogProductsPhase1Api();
  if (guard.error) return guard.error;
  const user = guard.user!;

  const body = await req.json().catch(() => ({}));
  const name = parseProductName(body.name);
  const type = parseCatalogProductType(body.type);
  const basePriceCents = parseBasePriceCents(body.basePriceCents ?? body.basePrice);
  const description = parseDescription(body.description);
  const categoryId = parseInt(String(body.categoryId ?? ""), 10);
  const isActive = body.isActive !== false;

  if (!name) {
    return NextResponse.json({ error: "El nombre es obligatorio (mínimo 2 caracteres)." }, { status: 400 });
  }
  if (!type) {
    return NextResponse.json({ error: "Elegí un tipo de producto válido." }, { status: 400 });
  }
  if (basePriceCents == null) {
    return NextResponse.json({ error: "El precio base debe ser mayor a cero." }, { status: 400 });
  }
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ error: "Elegí una categoría." }, { status: 400 });
  }

  const category = await prisma.catalogProductCategory.findFirst({
    where: { id: categoryId, userId: user.id },
  });
  if (!category) {
    return NextResponse.json({ error: "Categoría no encontrada." }, { status: 404 });
  }

  const componentsList = bodyIncludesComponents(body)
    ? (() => {
        const resolved = resolveComponentsFromBody(body);
        if (!resolved.ok) return { error: resolved.error } as const;
        return { list: resolved.components } as const;
      })()
    : { list: [] as CatalogComponentInput[] };

  if ("error" in componentsList) {
    return NextResponse.json({ error: componentsList.error }, { status: 400 });
  }

  const typeError = validateComponentsForType(type, componentsList.list);
  if (typeError) {
    return NextResponse.json({ error: typeError }, { status: 400 });
  }

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.catalogProduct.create({
      data: {
        userId: user.id,
        name,
        type,
        description,
        basePriceCents,
        categoryId,
        isActive,
        isArchived: false,
      },
    });
    if (componentsList.list.length > 0) {
      await replaceCatalogProductComponents(tx, created.id, componentsList.list);
    }
    return tx.catalogProduct.findUnique({
      where: { id: created.id },
      include: catalogProductInclude,
    });
  });

  if (!product) {
    return NextResponse.json({ error: "No se pudo crear el producto." }, { status: 500 });
  }

  return NextResponse.json(serializeCatalogProduct(product), { status: 201 });
}
