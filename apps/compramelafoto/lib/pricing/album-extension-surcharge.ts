import type { Prisma, PrismaClient } from "@/lib/prisma";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const ALBUM_EXTENSION_DEFAULT_SURCHARGE_PERCENT = 15;

export type AlbumExtensionWindowInput = {
  firstPhotoDate?: Date | null;
  createdAt?: Date;
  expirationExtensionDays?: number | null;
};

export type AlbumExtensionSurchargeMode =
  | { kind: "FIXED_PER_30_DAYS"; priceArs: number }
  | { kind: "PERCENT_OF_SUBTOTAL"; percent: number };

export function isAlbumExtensionPricingActive(
  album: AlbumExtensionWindowInput,
  now: Date = new Date()
): boolean {
  const extensionDays = getAlbumExtensionDays(album);
  if (extensionDays <= 0) return false;
  const baseDate = album.firstPhotoDate ?? album.createdAt;
  if (!baseDate) return false;
  const baseEnd = new Date(baseDate.getTime() + 30 * MS_PER_DAY);
  const extensionEnd = new Date(baseDate.getTime() + (30 + extensionDays) * MS_PER_DAY);
  return now >= baseEnd && now <= extensionEnd;
}

export function getAlbumExtensionDays(album: AlbumExtensionWindowInput): number {
  const days = album.expirationExtensionDays ?? 0;
  return Number.isFinite(days) && days > 0 ? Math.trunc(days) : 0;
}

export function resolveAlbumExtensionSurchargeMode(
  extensionPricePer30DaysArs: number | null | undefined
): AlbumExtensionSurchargeMode {
  if (
    typeof extensionPricePer30DaysArs === "number" &&
    Number.isFinite(extensionPricePer30DaysArs) &&
    extensionPricePer30DaysArs > 0
  ) {
    return { kind: "FIXED_PER_30_DAYS", priceArs: Math.round(extensionPricePer30DaysArs) };
  }
  return {
    kind: "PERCENT_OF_SUBTOTAL",
    percent: ALBUM_EXTENSION_DEFAULT_SURCHARGE_PERCENT,
  };
}

export function computeAlbumExtensionSurchargeArs(params: {
  clientSubtotalArs: number;
  extensionDays: number;
  mode: AlbumExtensionSurchargeMode;
}): number {
  const subtotal = Math.max(0, Math.round(params.clientSubtotalArs));
  const extensionDays = Math.max(0, Math.trunc(params.extensionDays));
  if (subtotal <= 0 || extensionDays <= 0) return 0;
  const periods = extensionDays / 30;
  if (params.mode.kind === "FIXED_PER_30_DAYS") {
    return Math.round(params.mode.priceArs * periods);
  }
  return Math.round(subtotal * (params.mode.percent / 100) * periods);
}

export function applyAlbumExtensionSurchargeToClientTotalArs(params: {
  clientSubtotalArs: number;
  extensionDays: number;
  mode: AlbumExtensionSurchargeMode;
  active: boolean;
}): { clientTotalArs: number; extensionSurchargeArs: number } {
  const clientSubtotalArs = Math.max(0, Math.round(params.clientSubtotalArs));
  if (!params.active) {
    return { clientTotalArs: clientSubtotalArs, extensionSurchargeArs: 0 };
  }
  const extensionSurchargeArs = computeAlbumExtensionSurchargeArs({
    clientSubtotalArs,
    extensionDays: params.extensionDays,
    mode: params.mode,
  });
  return {
    clientTotalArs: clientSubtotalArs + extensionSurchargeArs,
    extensionSurchargeArs,
  };
}

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export async function loadAlbumExtensionSurchargeModeForPhotographer(
  prismaClient: PrismaLike,
  photographerUserId: number
): Promise<AlbumExtensionSurchargeMode> {
  const salesSettings = await prismaClient.photographerSalesSettings.findUnique({
    where: { userId: photographerUserId },
    select: { storageExtendPricingJson: true },
  });
  const json = salesSettings?.storageExtendPricingJson as { price?: number } | null;
  return resolveAlbumExtensionSurchargeMode(json?.price);
}

export type AlbumExtensionSalesPricing = {
  active: boolean;
  extensionDays: number;
  extensionSurchargeArs: number;
  mode: AlbumExtensionSurchargeMode;
  surchargePercentForDisplay: number;
  fixedPricePer30DaysArs: number | null;
};

export async function resolveAlbumExtensionSalesPricing(params: {
  album: AlbumExtensionWindowInput & { userId?: number | null };
  clientSubtotalArs: number;
  prismaClient: PrismaLike;
  now?: Date;
}): Promise<AlbumExtensionSalesPricing> {
  const extensionDays = getAlbumExtensionDays(params.album);
  const active = isAlbumExtensionPricingActive(params.album, params.now);
  const defaultMode: AlbumExtensionSurchargeMode = {
    kind: "PERCENT_OF_SUBTOTAL",
    percent: ALBUM_EXTENSION_DEFAULT_SURCHARGE_PERCENT,
  };

  if (!active || !params.album.userId) {
    return {
      active: false,
      extensionDays,
      extensionSurchargeArs: 0,
      mode: defaultMode,
      surchargePercentForDisplay: 0,
      fixedPricePer30DaysArs: null,
    };
  }

  const mode = await loadAlbumExtensionSurchargeModeForPhotographer(
    params.prismaClient,
    params.album.userId
  );
  const extensionSurchargeArs = computeAlbumExtensionSurchargeArs({
    clientSubtotalArs: params.clientSubtotalArs,
    extensionDays,
    mode,
  });

  return {
    active: true,
    extensionDays,
    extensionSurchargeArs,
    mode,
    surchargePercentForDisplay:
      mode.kind === "PERCENT_OF_SUBTOTAL" ? mode.percent : 0,
    fixedPricePer30DaysArs:
      mode.kind === "FIXED_PER_30_DAYS" ? mode.priceArs : null,
  };
}
