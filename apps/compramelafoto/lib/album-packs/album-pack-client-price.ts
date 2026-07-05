import {
  clientTotalFromPhotographerBaseArs,
  platformFeeFromPhotographerBaseArs,
} from "@/lib/pricing/client-price";

/** Precio base del fotógrafo (AlbumPack.price) → total que paga el cliente, con fee de plataforma. */
export function albumPackClientPriceArs(
  photographerBaseArs: number,
  platformFeePercent: number
): number {
  return clientTotalFromPhotographerBaseArs(photographerBaseArs, platformFeePercent);
}

export function albumPackPlatformFeeArs(
  photographerBaseArs: number,
  platformFeePercent: number
): number {
  return platformFeeFromPhotographerBaseArs(photographerBaseArs, platformFeePercent);
}
