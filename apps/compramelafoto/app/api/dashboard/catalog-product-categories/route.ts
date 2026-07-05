import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCatalogProductsPhase1Api } from "@/lib/catalog-products/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireCatalogProductsPhase1Api();
  if (guard.error) return guard.error;
  const user = guard.user!;

  const categories = await prisma.catalogProductCategory.findMany({
    where: { userId: user.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { products: true } },
    },
  });

  return NextResponse.json({
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      productCount: c._count.products,
    })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireCatalogProductsPhase1Api();
  if (guard.error) return guard.error;
  const user = guard.user!;

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  if (name.length < 1) {
    return NextResponse.json({ error: "El nombre de la categoría es obligatorio." }, { status: 400 });
  }

  const existing = await prisma.catalogProductCategory.findFirst({
    where: { userId: user.id, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json({ error: "Ya existe una categoría con ese nombre." }, { status: 409 });
  }

  const sortOrder =
    typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
      ? Math.round(body.sortOrder)
      : 0;

  const category = await prisma.catalogProductCategory.create({
    data: { userId: user.id, name, sortOrder },
  });

  return NextResponse.json(
    { id: category.id, name: category.name, sortOrder: category.sortOrder, productCount: 0 },
    { status: 201 }
  );
}
