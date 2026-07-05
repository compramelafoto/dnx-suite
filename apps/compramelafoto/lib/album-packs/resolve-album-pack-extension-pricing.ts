import type { Prisma } from "@/lib/prisma";
import {
  applyAlbumExtensionSurchargeToClientTotalArs,
  resolveAlbumExtensionSalesPricing,
  type AlbumExtensionSalesPricing,
} from "@/lib/pricing/album-extension-surcharge";

type TxClient = Prisma.TransactionClient;

export type AlbumPackOrderExtensionTotals = {
  clientSubtotalArs: number;
  totalCents: number;
  extensionSurchargeCents: number;
  extensionPricing: AlbumExtensionSalesPricing;
};

export async function resolveAlbumPackOrderExtensionTotals(
  tx: TxClient,
  params: {
    albumId: number;
    clientSubtotalArs: number;
  }
): Promise<AlbumPackOrderExtensionTotals> {
  const clientSubtotalArs = Math.max(0, Math.round(params.clientSubtotalArs));
  const album = await tx.album.findUnique({
    where: { id: params.albumId },
    select: {
      userId: true,
      firstPhotoDate: true,
      createdAt: true,
      expirationExtensionDays: true,
    },
  });

  if (!album?.userId) {
    return {
      clientSubtotalArs,
      totalCents: clientSubtotalArs,
      extensionSurchargeCents: 0,
      extensionPricing: {
        active: false,
        extensionDays: 0,
        extensionSurchargeArs: 0,
        mode: { kind: "PERCENT_OF_SUBTOTAL", percent: 15 },
        surchargePercentForDisplay: 0,
        fixedPricePer30DaysArs: null,
      },
    };
  }

  const extensionPricing = await resolveAlbumExtensionSalesPricing({
    album,
    clientSubtotalArs,
    prismaClient: tx,
  });

  const priced = applyAlbumExtensionSurchargeToClientTotalArs({
    clientSubtotalArs,
    extensionDays: extensionPricing.extensionDays,
    mode: extensionPricing.mode,
    active: extensionPricing.active,
  });

  return {
    clientSubtotalArs,
    totalCents: priced.clientTotalArs,
    extensionSurchargeCents: priced.extensionSurchargeArs,
    extensionPricing,
  };
}
