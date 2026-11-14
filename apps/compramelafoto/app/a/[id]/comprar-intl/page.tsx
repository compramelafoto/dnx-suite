import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { shouldUseIntlFlow, computeIntlDigitalTotals } from "@/lib/international/intl-order";
import { parseIntlCheckoutPhotoIds } from "@/lib/international/intl-gallery";
import { formatMoney } from "@/lib/international/money";
import IntlCheckoutClient from "./IntlCheckoutClient";

export const dynamic = "force-dynamic";

/** CLF internacional (piloto): compra de fotos digitales en la moneda del álbum. */
export default async function ComprarIntlPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fotos?: string }>;
}) {
  const { id } = await params;
  const { fotos } = await searchParams;
  const albumId = Number(id);
  if (!Number.isInteger(albumId) || albumId <= 0) notFound();

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, title: true, currency: true, digitalPhotoPriceCents: true },
  });
  if (!album || !shouldUseIntlFlow(album.currency)) notFound();

  const requested = parseIntlCheckoutPhotoIds(fotos ?? null);
  const photos = requested.length
    ? await prisma.photo.findMany({
        where: { id: { in: requested }, albumId, isRemoved: false },
        select: { id: true },
      })
    : [];
  const photoIds = photos.map((p) => p.id);
  const unit = album.digitalPhotoPriceCents ?? 0;
  const totals = computeIntlDigitalTotals({ unitPriceStored: unit, photoCount: photoIds.length });

  return (
    <IntlCheckoutClient
      albumId={album.id}
      albumTitle={album.title}
      photoIds={photoIds}
      unitLabel={formatMoney(computeIntlDigitalTotals({ unitPriceStored: unit, photoCount: 1 }).totalStored, album.currency)}
      totalLabel={formatMoney(totals.totalStored, album.currency)}
      canBuy={unit > 0 && photoIds.length > 0}
    />
  );
}
