import { Prisma } from "@/lib/prisma";
import { clientTotalArsFromPhotographerBaseArs } from "@/lib/preventa-canjeable/pack-client-price";
import type { PackLine } from "@/lib/preventa-canjeable/precompra-pack-order-transaction";

export type PrecompraRequestBody = {
  albumId: number;
  buyerEmail: string;
  buyerUserId: number | null;
  buyerName: string | null;
  buyerPhone: string | null;
  schoolCourseId: number | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  albumRosterEntryId: number | null;
  organizerReferralSchoolId: number | null;
  items: unknown[];
};

export function parsePrecompraRequest(body: unknown): PrecompraRequestBody {
  const raw = (body ?? {}) as Record<string, unknown>;
  return {
    albumId: Number(raw.albumId),
    buyerEmail: String(raw.buyerEmail ?? "").trim(),
    buyerUserId: raw.buyerUserId != null ? Number(raw.buyerUserId) : null,
    buyerName: raw.buyerName ? String(raw.buyerName).trim() : null,
    buyerPhone: raw.buyerPhone ? String(raw.buyerPhone).trim() : null,
    schoolCourseId: raw.schoolCourseId != null ? Number(raw.schoolCourseId) : null,
    studentFirstName: raw.studentFirstName ? String(raw.studentFirstName).trim() : null,
    studentLastName: raw.studentLastName ? String(raw.studentLastName).trim() : null,
    albumRosterEntryId: (() => {
      if (raw.albumRosterEntryId == null || raw.albumRosterEntryId === "") return null;
      const n = Number(raw.albumRosterEntryId);
      return Number.isFinite(n) ? n : null;
    })(),
    organizerReferralSchoolId: (() => {
      if (raw.organizerReferralSchoolId == null || raw.organizerReferralSchoolId === "") return null;
      const n = Number(raw.organizerReferralSchoolId);
      return Number.isFinite(n) ? n : null;
    })(),
    items: Array.isArray(raw.items) ? raw.items : [],
  };
}

export function hasLegacyAlbumProductItem(items: unknown[]): boolean {
  for (const it of items) {
    if (it != null && typeof it === "object" && (it as { albumProductId?: unknown }).albumProductId != null) {
      return true;
    }
  }
  return false;
}

export function buildOrderItems(
  items: unknown[],
  packById: Map<number, { id: number; priceClientArs: number }>,
  platformPercent: number
): PackLine[] {
  const orderItems: PackLine[] = [];
  for (const it of items) {
    if (it == null || typeof it !== "object") continue;
    const raw = it as { packDefinitionId?: unknown; quantity?: unknown };
    const pid = Number(raw.packDefinitionId);
    const qty = Math.max(1, Math.min(100, Number(raw.quantity) || 1));
    if (!Number.isInteger(pid) || pid <= 0) continue;
    const pack = packById.get(pid);
    if (!pack) continue;
    const unitClientArs = clientTotalArsFromPhotographerBaseArs(pack.priceClientArs, platformPercent);
    const priceCents = unitClientArs * 100;
    orderItems.push({ packDefinitionId: pid, priceCents, quantity: qty });
  }
  return orderItems;
}

export function mergePackLines(orderItems: PackLine[]): Map<number, PackLine> {
  const mergedByPack = new Map<number, PackLine>();
  for (const it of orderItems) {
    const prev = mergedByPack.get(it.packDefinitionId);
    if (prev) {
      prev.quantity += it.quantity;
    } else {
      mergedByPack.set(it.packDefinitionId, { ...it });
    }
  }
  return mergedByPack;
}

export function buildPricingSnapshot(
  packDefinitionId: number,
  platformPercent: number,
  marketplaceFeeCents: number
): Prisma.InputJsonValue {
  return {
    preventaPackV1: { packDefinitionId },
    marketplaceFeePercent: platformPercent,
    marketplaceFeeCents,
  };
}
