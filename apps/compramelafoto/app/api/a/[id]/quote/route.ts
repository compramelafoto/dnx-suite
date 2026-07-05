import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeCheckoutTotals } from "@/lib/pricing/pricing-engine";
import { denyIfTestAlbumNotOwnerPreview } from "@/lib/public-album-test-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const albumRow = await prisma.album.findUnique({
      where: { id: albumId },
      select: { isTest: true, userId: true },
    });
    if (!albumRow) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }
    const testDeny = await denyIfTestAlbumNotOwnerPreview(albumRow);
    if (testDeny) return testDeny;

    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? body.items : [];
    console.info("[quote] start", { albumId, itemsCount: items.length });
    const rawPack = body.faceBulkPackPhotoIds;
    const faceBulkPackPhotoIds = Array.isArray(rawPack)
      ? rawPack
          .map((n: unknown) => parseInt(String(n), 10))
          .filter((n: number) => Number.isFinite(n) && n > 0)
      : undefined;

    const normalized = items.map((it: any) => ({
      fileKey: it.fileKey,
      size: it.size ?? null,
      finish: it.finish ?? it.acabado ?? null,
      quantity: it.quantity,
      tipo: it.tipo,
      productId: it.productId ?? null,
      productName: it.productName ?? null,
      includedWithPrint: Boolean(it.includedWithPrint),
      uploaderId: it.uploaderId ?? null,
      uploaderDigitalPriceCents: it.uploaderDigitalPriceCents ?? null,
    }));

    if (!normalized.length) {
      return NextResponse.json({ error: "Items inválidos para cotizar." }, { status: 400 });
    }

    const totals = await computeCheckoutTotals({
      flow: "ALBUM_ORDER",
      albumId,
      items: normalized,
      faceBulkPackPhotoIds,
    });

    return NextResponse.json(
      {
        totals: {
          displayTotalCents: totals.displayTotalCents,
          mpTotalCents: totals.mpTotalCents,
          marketplaceFeeCents: totals.marketplaceFeeCents,
          components: totals.components,
        },
        items: totals.items,
        snapshot: totals.snapshot,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[quote] error", err);
    return NextResponse.json(
      { error: "Error cotizando", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
