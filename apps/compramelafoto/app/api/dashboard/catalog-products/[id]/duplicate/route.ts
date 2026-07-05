import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCatalogProductsPhase1Api } from "@/lib/catalog-products/api-guard";
import { replaceCatalogProductComponents } from "@/lib/catalog-products/components";
import { catalogProductInclude } from "@/lib/catalog-products/product-include";
import { serializeCatalogProduct } from "@/lib/catalog-products/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
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

  const source = await prisma.catalogProduct.findFirst({
    where: { id: productId, userId: user.id },
    include: {
      images: true,
      components: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!source) {
    return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
  }

  const copyName = `Copia de ${source.name}`.slice(0, 200);

  const created = await prisma.$transaction(async (tx) => {
    const product = await tx.catalogProduct.create({
      data: {
        userId: user.id,
        name: copyName,
        type: source.type,
        description: source.description,
        basePriceCents: source.basePriceCents,
        categoryId: source.categoryId,
        isActive: source.isActive,
        isArchived: false,
        sortOrder: source.sortOrder,
      },
    });

    const mockup = source.images.find((i) => i.role === "MOCKUP") ?? source.images[0];
    if (mockup) {
      await tx.catalogProductImage.create({
        data: {
          productId: product.id,
          storageKey: mockup.storageKey,
          publicUrl: mockup.publicUrl,
          role: mockup.role,
        },
      });
    }

    if (source.components.length > 0) {
      await replaceCatalogProductComponents(
        tx,
        product.id,
        source.components.map((c) => ({
          name: c.name,
          quantity: c.quantity,
          deliveryType: c.deliveryType,
          sortOrder: c.sortOrder,
          notes: c.notes,
        }))
      );
    }

    return tx.catalogProduct.findUnique({
      where: { id: product.id },
      include: catalogProductInclude,
    });
  });

  if (!created) {
    return NextResponse.json({ error: "No se pudo duplicar." }, { status: 500 });
  }

  return NextResponse.json(serializeCatalogProduct(created), { status: 201 });
}
