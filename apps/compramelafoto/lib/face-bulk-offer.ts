import { totalFromBase } from "@/lib/pricing/fee-formula";

/**
 * Oferta “comprar todas las fotos donde aparezco” (reconocimiento / pack).
 * Una sola fuente de verdad para elegibilidad económica (no duplicar en UI).
 *
 * - `faceBulkPriceCents` y `digitalPhotoPriceCents` en DB = precio base (lo que define el fotógrafo).
 * - Con `platformFeePercent`, la UI y la comparación “te conviene” usan el total que paga el cliente (base + fee),
 *   alineado con `pricing-engine` para digitales (`getPlatformFeePercent`).
 */
export type FaceBulkOfferAlbumSlice = {
  enableFaceBulkPurchase?: boolean;
  /** Nombre histórico “Cents”: en práctica son pesos ARS enteros (misma unidad que el precio digital del álbum en dashboard). */
  faceBulkPriceCents?: number | null;
  /** Pesos ARS enteros por foto (columna *Cents en DB). */
  digitalPhotoPriceCents?: number | null;
};

export type FaceBulkOfferComputation = {
  eligible: boolean;
  /** Base pack (fotógrafo). */
  faceBulkPriceCents: number;
  /** Base por foto individual (fotógrafo). */
  digitalPhotoPriceCents: number;
  packPhotoCount: number;
  /** Suma base si comprara cada foto del pack por separado (sin fee). */
  individualTotalBaseCents: number;
  /** Total cliente si comprara cada foto del pack por separado (con fee). */
  individualTotalClientCents: number;
  /** Total cliente del pack (base pack + fee). */
  packTotalClientCents: number;
  /** Precio cliente por una foto digital suelta (base + fee), para copy “cada una”. */
  digitalUnitClientCents: number;
  /** Ahorro cliente (individual final − pack final). */
  savingsClientCents: number;
  /** @deprecated usar individualTotalClientCents — se mantiene para UI (tachado = total cliente). */
  individualTotalCents: number;
  /** @deprecated usar savingsClientCents */
  savingsCents: number;
};

export type ComputeFaceBulkOfferOptions = {
  /** % fee plataforma sobre base (mismo criterio que digitales en checkout). Si se omite, elegibilidad usa solo bases. */
  platformFeePercent?: number;
};

export function computeFaceBulkOffer(
  album: FaceBulkOfferAlbumSlice,
  packPhotoIds: ReadonlyArray<number>,
  options?: ComputeFaceBulkOfferOptions
): FaceBulkOfferComputation {
  const faceBulkPriceCents =
    typeof album.faceBulkPriceCents === "number" && Number.isFinite(album.faceBulkPriceCents)
      ? album.faceBulkPriceCents
      : 0;
  const digitalPhotoPriceCents =
    typeof album.digitalPhotoPriceCents === "number" && Number.isFinite(album.digitalPhotoPriceCents)
      ? album.digitalPhotoPriceCents
      : 0;
  const packPhotoCount = packPhotoIds.length;
  const individualTotalBaseCents =
    packPhotoCount >= 1 && digitalPhotoPriceCents > 0
      ? packPhotoCount * digitalPhotoPriceCents
      : 0;

  const pct = options?.platformFeePercent;
  const hasPct = typeof pct === "number" && Number.isFinite(pct) && pct >= 0;

  const individualTotalClientCents = hasPct
    ? packPhotoCount >= 1 && digitalPhotoPriceCents > 0
      ? packPhotoCount * totalFromBase(Math.round(digitalPhotoPriceCents), pct)
      : 0
    : individualTotalBaseCents;

  const packTotalClientCents = hasPct
    ? totalFromBase(Math.round(faceBulkPriceCents), pct)
    : faceBulkPriceCents;

  const digitalUnitClientCents = hasPct
    ? digitalPhotoPriceCents > 0
      ? totalFromBase(Math.round(digitalPhotoPriceCents), pct)
      : 0
    : digitalPhotoPriceCents;

  const eligible = hasPct
    ? album.enableFaceBulkPurchase === true &&
      faceBulkPriceCents > 0 &&
      packPhotoCount >= 1 &&
      digitalPhotoPriceCents > 0 &&
      individualTotalClientCents > packTotalClientCents
    : album.enableFaceBulkPurchase === true &&
      faceBulkPriceCents > 0 &&
      packPhotoCount >= 1 &&
      digitalPhotoPriceCents > 0 &&
      individualTotalBaseCents > faceBulkPriceCents;

  const savingsClientCents = eligible
    ? hasPct
      ? individualTotalClientCents - packTotalClientCents
      : individualTotalBaseCents - faceBulkPriceCents
    : 0;

  const individualTotalCents = hasPct ? individualTotalClientCents : individualTotalBaseCents;
  const savingsCents = savingsClientCents;

  return {
    eligible,
    faceBulkPriceCents,
    digitalPhotoPriceCents,
    packPhotoCount,
    individualTotalBaseCents,
    individualTotalClientCents,
    packTotalClientCents,
    digitalUnitClientCents,
    savingsClientCents,
    individualTotalCents,
    savingsCents,
  };
}

export function faceBulkOfferSessionKey(albumId: number): string {
  return `album_${albumId}_face_bulk_offer_v1`;
}

export type FaceBulkOfferSessionValue = "dismissed" | "converted";

export function readFaceBulkOfferSession(albumId: number): FaceBulkOfferSessionValue | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(faceBulkOfferSessionKey(albumId));
  if (raw === "dismissed" || raw === "converted") return raw;
  return null;
}

export function writeFaceBulkOfferSession(albumId: number, value: FaceBulkOfferSessionValue): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(faceBulkOfferSessionKey(albumId), value);
}
