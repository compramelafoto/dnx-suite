import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPhotographerPricing } from "@/lib/pricing/photographer-pricing";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const photographerIdParam = searchParams.get("photographerId");
    const labIdParam = searchParams.get("labId");
    const photographerId = photographerIdParam ? Number(photographerIdParam) : null;
    const labId = labIdParam ? Number(labIdParam) : null;

    // Si se pasa labId, devolver descuentos del laboratorio (para panel LAB)
    if (labId != null && Number.isFinite(labId)) {
      const priceTypeParam = searchParams.get("priceType") || "PROFESSIONAL";
      const priceType = priceTypeParam === "PUBLIC" ? "PUBLIC" : "PROFESSIONAL";
      const discounts = await prisma.labSizeDiscount.findMany({
        where: { labId, isActive: true, priceType },
        orderBy: [{ size: "asc" }, { minQty: "asc" }],
        select: { size: true, minQty: true, discountPercent: true },
      });
      return NextResponse.json(
        { discounts: discounts.map((d) => ({ size: d.size, minQty: d.minQty, discountPercent: d.discountPercent })) },
        { status: 200 }
      );
    }

    if (photographerIdParam && !Number.isFinite(photographerId)) {
      return NextResponse.json(
        { error: "photographerId es requerido y debe ser un número válido" },
        { status: 400 }
      );
    }

    const pricing = await getPhotographerPricing(photographerId);
    const platformCommissionPercent = await resolvePlatformCommissionPercent({
      photographerId: pricing.photographerId ?? photographerId,
    });

    if (!pricing.photographerId) {
      return NextResponse.json(
        { error: "No se encontraron precios del fotógrafo" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        photographer: {
          id: pricing.photographerId,
          name: pricing.photographerName,
        },
        basePrices: pricing.basePrices,
        discounts: pricing.discounts,
        products: pricing.products,
        platformCommissionPercent,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("GET /api/lab/pricing ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo pricing", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

type BasePriceInput = { size: string; unitPrice: number };
type DiscountInput = { size: string; minQty: number; discountPercent: number; priceType?: string };

export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const labIdParam = searchParams.get("labId");
    const labId = labIdParam ? Number(labIdParam) : null;

    if (!labId || !Number.isFinite(labId)) {
      return NextResponse.json(
        { error: "labId es requerido y debe ser un número válido" },
        { status: 400 }
      );
    }

    // Verificar que el laboratorio existe
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
      select: { id: true },
    });

    if (!lab) {
      return NextResponse.json(
        { error: "Laboratorio no encontrado" },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const basePrices: BasePriceInput[] = Array.isArray(body?.basePrices) ? body.basePrices : [];
    const discounts: DiscountInput[] = Array.isArray(body?.discounts) ? body.discounts : [];

    // 1) Guardar precios base
    for (const b of basePrices) {
      const size = String(b.size || "").trim();
      const unitPrice = Number(b.unitPrice);

      if (!size || !Number.isFinite(unitPrice)) continue;

      await prisma.labBasePrice.upsert({
        where: { labId_size: { labId, size } },
        update: { unitPrice, currency: "ARS", isActive: true },
        create: { labId, size, unitPrice, currency: "ARS", isActive: true },
      });
    }

    // 2) Guardar descuentos (por tamaño y tramo, incluyendo GLOBAL)
    const priceType = body?.priceType === "PUBLIC" ? "PUBLIC" : "PROFESSIONAL";
    for (const d of discounts) {
      const size = String(d.size || "").trim();
      const minQty = Number(d.minQty);
      const discountPercent = Number(d.discountPercent);

      if (!size || !Number.isFinite(minQty) || !Number.isFinite(discountPercent)) continue;

      await prisma.labSizeDiscount.upsert({
        where: { labId_size_minQty_priceType: { labId, size, minQty, priceType } },
        update: { discountPercent, isActive: true },
        create: { labId, size, minQty, discountPercent, priceType, isActive: true },
      });
    }

    // 3) Devolver lo guardado (refrescado)
    const refreshedBase = await prisma.labBasePrice.findMany({
      where: { labId, isActive: true },
      orderBy: { size: "asc" },
    });

    const refreshedDisc = await prisma.labSizeDiscount.findMany({
      where: { labId, isActive: true, priceType },
      orderBy: [{ size: "asc" }, { minQty: "asc" }],
    });

    console.log(`PUT /api/lab/pricing: Guardados ${refreshedBase.length} precios base y ${refreshedDisc.length} descuentos para lab ${labId}`);

    return NextResponse.json(
      { ok: true, basePrices: refreshedBase, discounts: refreshedDisc },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("PUT /api/lab/pricing ERROR >>>", err);
    return NextResponse.json(
      { error: "Error guardando pricing", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
