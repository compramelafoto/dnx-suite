import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCatalogProductsPhase1Api } from "@/lib/catalog-products/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const guard = await requireCatalogProductsPhase1Api();
  if (guard.error) return guard.error;
  const user = guard.user!;

  const categoryId = parseInt((await Promise.resolve(params)).id, 10);
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const existing = await prisma.catalogProductCategory.findFirst({
    where: { id: categoryId, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Categoría no encontrada." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const data: { name?: string; sortOrder?: number } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    if (name.length < 1) {
      return NextResponse.json({ error: "Nombre inválido." }, { status: 400 });
    }
    const dup = await prisma.catalogProductCategory.findFirst({
      where: {
        userId: user.id,
        name: { equals: name, mode: "insensitive" },
        NOT: { id: categoryId },
      },
    });
    if (dup) {
      return NextResponse.json({ error: "Ya existe una categoría con ese nombre." }, { status: 409 });
    }
    data.name = name;
  }

  if (body.sortOrder !== undefined) {
    const sortOrder = parseInt(String(body.sortOrder), 10);
    if (Number.isFinite(sortOrder)) data.sortOrder = sortOrder;
  }

  const updated = await prisma.catalogProductCategory.update({
    where: { id: categoryId },
    data,
    include: { _count: { select: { products: true } } },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    sortOrder: updated.sortOrder,
    productCount: updated._count.products,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const guard = await requireCatalogProductsPhase1Api();
  if (guard.error) return guard.error;
  const user = guard.user!;

  const categoryId = parseInt((await Promise.resolve(params)).id, 10);
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const existing = await prisma.catalogProductCategory.findFirst({
    where: { id: categoryId, userId: user.id },
    include: { _count: { select: { products: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Categoría no encontrada." }, { status: 404 });
  }

  if (existing._count.products > 0) {
    return NextResponse.json(
      { error: "No podés eliminar una categoría con productos asignados." },
      { status: 409 }
    );
  }

  await prisma.catalogProductCategory.delete({ where: { id: categoryId } });
  return NextResponse.json({ ok: true });
}
