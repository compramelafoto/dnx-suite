const SINGLE_DRAFT_PREFIX = "ALBUM_PACK_DRAFT:";
const CART_PREFIX = "ALBUM_PACK_CART:";

export function normalizeAlbumPackCartDraftIds(draftIds: string[]): string[] {
  return Array.from(
    new Set(
      draftIds
        .map((id) => String(id ?? "").trim())
        .filter((id) => id.length > 0)
    )
  ).sort();
}

export function buildAlbumPackCartPaymentRef(draftIds: string[]): string {
  const normalized = normalizeAlbumPackCartDraftIds(draftIds);
  if (normalized.length === 0) {
    throw new Error("draftIds vacío.");
  }
  if (normalized.length === 1) {
    return `${SINGLE_DRAFT_PREFIX}${normalized[0]}`;
  }
  return `${CART_PREFIX}${normalized.join("|")}`;
}

export function parseAlbumPackCartDraftIdsFromPaymentRef(
  paymentRef: string | null | undefined
): string[] {
  const ref = String(paymentRef ?? "").trim();
  if (!ref) return [];
  if (ref.startsWith(SINGLE_DRAFT_PREFIX)) {
    const draftId = ref.slice(SINGLE_DRAFT_PREFIX.length).trim();
    return draftId ? [draftId] : [];
  }
  if (ref.startsWith(CART_PREFIX)) {
    return normalizeAlbumPackCartDraftIds(ref.slice(CART_PREFIX.length).split("|"));
  }
  return [];
}

export function readAlbumPackCartDraftIdsFromSnapshot(
  pricingSnapshot: unknown,
  paymentRef?: string | null
): string[] {
  const fromRef = parseAlbumPackCartDraftIdsFromPaymentRef(paymentRef);
  if (fromRef.length > 0) return fromRef;

  if (!pricingSnapshot || typeof pricingSnapshot !== "object") return [];
  const snap = pricingSnapshot as Record<string, unknown>;
  const cartDraftIds = snap.cartDraftIds;
  if (Array.isArray(cartDraftIds)) {
    return normalizeAlbumPackCartDraftIds(cartDraftIds.map((id) => String(id)));
  }
  const draftId = String(snap.draftId ?? "").trim();
  return draftId ? [draftId] : [];
}
