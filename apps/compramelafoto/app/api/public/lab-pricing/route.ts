import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPhotographerPricing } from "@/lib/pricing/photographer-pricing";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";
import { getPlatformFeePercent } from "@/lib/pricing/print-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Precios públicos. ?photographerId=X, ?handler=slug (fotógrafo) o ?labId=X (laboratorio landing)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const photographerIdParam = searchParams.get("photographerId");
    const labIdParam = searchParams.get("labId");
    const handlerParam = searchParams.get("handler");
    const photographerId = photographerIdParam ? Number(photographerIdParam) : null;
    const labId = labIdParam ? Number(labIdParam) : null;

    if (labId != null && Number.isFinite(labId)) {
      const lab = await prisma.lab.findUnique({
        where: { id: labId, isActive: true },
        select: {
          id: true,
          name: true,
          basePrices: { where: { isActive: true }, select: { size: true, unitPrice: true } },
          discounts: { where: { isActive: true }, select: { size: true, minQty: true, discountPercent: true } },
          products: { where: { isActive: true }, select: { id: true, name: true, size: true, acabado: true, retailPrice: true, photographerPrice: true } },
        },
      });
      if (!lab) {
        return NextResponse.json({ error: "Laboratorio no encontrado" }, { status: 404 });
      }
      const platformCommissionPercent = photographerId && Number.isFinite(photographerId)
        ? await resolvePlatformCommissionPercent({ photographerId, labId })
        : await getPlatformFeePercent();
      return NextResponse.json({
        lab: { id: lab.id, name: lab.name },
        basePrices: lab.basePrices,
        discounts: lab.discounts,
        products: lab.products.map((p) => ({
          id: p.id,
          name: p.name,
          size: p.size,
          acabado: p.acabado,
          retailPrice: p.retailPrice,
          photographerPrice: p.photographerPrice,
        })),
        platformCommissionPercent,
      }, { status: 200 });
    }

    if (photographerIdParam && !Number.isFinite(photographerId)) {
      return NextResponse.json({ error: "photographerId inválido" }, { status: 400 });
    }

    let resolvedPhotographerId = photographerId;
    const normalizedHandler = handlerParam ? handlerParam.trim().toLowerCase() : "";
    if (!resolvedPhotographerId && normalizedHandler) {
      const photographer = await prisma.user.findFirst({
        where: {
          publicPageHandler: normalizedHandler,
          isPublicPageEnabled: true,
          role: "PHOTOGRAPHER",
        },
        select: { id: true },
      });
      if (!photographer) {
        return NextResponse.json({ error: "Fotógrafo no encontrado" }, { status: 404 });
      }
      resolvedPhotographerId = photographer.id;
    }

    const pricing = await getPhotographerPricing(resolvedPhotographerId);
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
    console.error("GET /api/public/lab-pricing ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo precios", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
