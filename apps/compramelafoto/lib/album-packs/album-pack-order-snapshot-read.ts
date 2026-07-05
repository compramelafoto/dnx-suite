import {
  isAlbumPackOrderSnapshotLegacy,
  isAlbumPackOrderSnapshotV2,
} from "@/lib/album-packs/resolve-album-pack-order-lines";
import type { AlbumPackOrderLinesPricing } from "@/lib/album-packs/album-pack-composition-types";

export { isAlbumPackOrderSnapshotLegacy, isAlbumPackOrderSnapshotV2 };

export function isAlbumPackOrderPricingSnapshot(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;
  const type = String((snapshot as Record<string, unknown>).type ?? "").trim();
  return type === "ALBUM_PACK_ORDER_V1" || type === "ALBUM_PACK_ORDER_V2";
}

export function getAlbumPackNameFromSnapshot(pricingSnapshot: unknown): string {
  if (pricingSnapshot && typeof pricingSnapshot === "object") {
    const packName = String((pricingSnapshot as Record<string, unknown>).packName ?? "").trim();
    if (packName) return packName;
  }
  return "Pack de fotos";
}

/** Lee pricing de snapshot V1 (campos planos) o V2 (`pricing` anidado). */
export function readAlbumPackOrderSnapshotPricing(
  pricingSnapshot: unknown
): Partial<AlbumPackOrderLinesPricing> & { totalCents?: number } {
  if (!pricingSnapshot || typeof pricingSnapshot !== "object") {
    return {};
  }
  const snap = pricingSnapshot as Record<string, unknown>;

  if (isAlbumPackOrderSnapshotV2(snap)) {
    return {
      ...snap.pricing,
      totalCents: snap.pricing.totalCents,
    };
  }

  return {
    totalCents:
      Number.isFinite(Number(snap.totalCents)) && Number(snap.totalCents) >= 0
        ? Math.round(Number(snap.totalCents))
        : Number.isFinite(Number(snap.clientTotalArs)) && Number(snap.clientTotalArs) >= 0
          ? Math.round(Number(snap.clientTotalArs))
          : undefined,
    basePriceArs:
      Number.isFinite(Number(snap.basePriceArs)) && Number(snap.basePriceArs) >= 0
        ? Math.round(Number(snap.basePriceArs))
        : undefined,
    marketplaceFeePercent: Math.max(0, Math.round(Number(snap.marketplaceFeePercent) || 0)),
    marketplaceFeeCents:
      Number.isFinite(Number(snap.marketplaceFeeCents)) && Number(snap.marketplaceFeeCents) >= 0
        ? Math.round(Number(snap.marketplaceFeeCents))
        : undefined,
    clientTotalArs:
      Number.isFinite(Number(snap.clientTotalArs)) && Number(snap.clientTotalArs) >= 0
        ? Math.round(Number(snap.clientTotalArs))
        : undefined,
  };
}

export function getAlbumPackOrderSnapshotType(pricingSnapshot: unknown): string {
  if (!pricingSnapshot || typeof pricingSnapshot !== "object") return "";
  return String((pricingSnapshot as Record<string, unknown>).type ?? "").trim();
}
