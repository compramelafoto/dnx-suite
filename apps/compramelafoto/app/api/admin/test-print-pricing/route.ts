import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPlatformFeePercent, computePrintPricing } from "@/lib/pricing/print-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/test-print-pricing?albumId=1&productId=1&quantity=2
 * Devuelve el desglose de precios de impresión (base → margen álbum → fee plataforma).
 * Requiere rol ADMIN.
 */
export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const albumId = searchParams.get("albumId");
    const productId = searchParams.get("productId");
    const quantity = Math.max(1, parseInt(searchParams.get("quantity") || "1", 10) || 1);

    let albumMarginPercent = 0;
    if (albumId) {
      const album = await prisma.album.findUnique({
        where: { id: parseInt(albumId, 10) },
        select: { albumProfitMarginPercent: true },
      });
      if (album?.albumProfitMarginPercent != null) {
        albumMarginPercent = Number(album.albumProfitMarginPercent);
      }
    }

    let baseUnitPrice = 0;
    if (productId) {
      const product = await prisma.photographerProduct.findUnique({
        where: { id: parseInt(productId, 10) },
        select: { retailPrice: true },
      });
      if (product?.retailPrice != null) {
        baseUnitPrice = Number(product.retailPrice);
      }
    }

    const platformFeePercent = await getPlatformFeePercent();
    const breakdown = computePrintPricing({
      baseUnitPrice,
      albumMarginPercent,
      platformFeePercent,
      quantity,
    });

    return NextResponse.json({
      albumId: albumId || null,
      productId: productId || null,
      albumMarginPercent,
      platformFeePercent,
      breakdown,
    });
  } catch (err: unknown) {
    console.error("GET /api/admin/test-print-pricing ERROR >>>", err);
    return NextResponse.json(
      { error: "Error calculando desglose", detail: String((err as Error)?.message) },
      { status: 500 }
    );
  }
}
