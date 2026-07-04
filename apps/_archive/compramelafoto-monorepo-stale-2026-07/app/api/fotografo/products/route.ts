import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol PHOTOGRAPHER." },
        { status: 401 }
      );
    }

    const prismaAny = prisma as any;
    if (!prismaAny.photographerProduct?.findMany) {
      return NextResponse.json({ products: [] });
    }

    const products = await prismaAny.photographerProduct.findMany({
      where: { userId: user.id },
      orderBy: [
        { name: "asc" },
        { size: "asc" },
      ],
    });

    return NextResponse.json({ products });
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (msg.includes("PhotographerProduct") && msg.includes("does not exist")) {
      return NextResponse.json({ products: [] });
    }
    console.error("GET /api/fotografo/products ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo productos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol PHOTOGRAPHER." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const products = Array.isArray(body?.products) ? body.products : [];

    const sanitized = products
      .map((p: any) => {
        const name = String(p?.name ?? "").trim();
        const retailPrice = Math.round(Number(p?.retailPrice ?? p?.retailPriceCents ?? 0));
        return {
          id: p?.id ? Number(p.id) : null,
          name,
          size: p?.size ? String(p.size).trim() : null,
          acabado: p?.acabado ? String(p.acabado).trim() : null,
          retailPrice,
          currency: String(p?.currency ?? "ARS"),
          isActive: p?.isActive !== false,
        };
      })
      .filter((p: any) => p.name && Number.isFinite(p.retailPrice) && p.retailPrice >= 0);

    const prismaAny = prisma as any;
    if (!prismaAny.photographerProduct?.delete || !prismaAny.photographerProduct?.create) {
      return NextResponse.json(
        { error: "La base de datos no soporta productos de fotógrafo aún." },
        { status: 409 }
      );
    }

    const existingProducts = await prismaAny.photographerProduct.findMany({
      where: { userId: user.id },
    });
    const existingIds = new Set(sanitized.map((p: any) => p.id).filter(Boolean));
    const toDelete = existingProducts.filter((p: any) => !existingIds.has(p.id));
    for (const product of toDelete) {
      await prismaAny.photographerProduct.delete({ where: { id: product.id } });
    }

    for (const product of sanitized) {
      const data = {
        userId: user.id,
        name: product.name,
        size: product.size,
        acabado: product.acabado,
        retailPrice: product.retailPrice,
        currency: product.currency,
        isActive: product.isActive,
      };
      if (product.id) {
        await prismaAny.photographerProduct.update({
          where: { id: product.id },
          data,
        });
      } else {
        await prismaAny.photographerProduct.create({ data });
      }
    }

    const updated = await prismaAny.photographerProduct.findMany({
      where: { userId: user.id },
      orderBy: [
        { name: "asc" },
        { size: "asc" },
      ],
    });

    return NextResponse.json({ products: updated });
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (msg.includes("PhotographerProduct") && msg.includes("does not exist")) {
      return NextResponse.json(
        { error: "Falta crear la tabla PhotographerProduct. Ejecutá migraciones." },
        { status: 409 }
      );
    }
    console.error("PUT /api/fotografo/products ERROR >>>", err);
    return NextResponse.json(
      { error: "Error guardando productos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
