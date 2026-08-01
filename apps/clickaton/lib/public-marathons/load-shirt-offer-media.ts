import "server-only";

import { prisma } from "@repo/db";
import type { ShirtOfferMedia } from "@/components/marathon/MarathonShirtOffer";

/** Media pública de remera para ficha de maratón (R2). */
export async function loadShirtOfferMedia(
  editionId: string,
): Promise<ShirtOfferMedia[]> {
  const shirt = await prisma.clickatonProduct.findFirst({
    where: {
      editionId,
      code: { contains: "REMERA", mode: "insensitive" },
    },
    select: { id: true, name: true },
  });
  if (!shirt) return [];

  const media = await prisma.clickatonProductMedia.findMany({
    where: { productId: shirt.id, status: "ACTIVE" },
    orderBy: { sortOrder: "asc" },
    select: { mediaType: true, assetId: true },
  });

  const out: ShirtOfferMedia[] = [];
  for (const m of media) {
    if (!m.assetId) continue;
    const asset = await prisma.dnxMediaAsset.findUnique({
      where: { id: m.assetId },
      select: { publicUrl: true },
    });
    if (!asset?.publicUrl) continue;
    out.push({
      mediaType: m.mediaType,
      url: asset.publicUrl,
      alt: `${shirt.name} — ${m.mediaType}`,
    });
  }
  return out;
}
