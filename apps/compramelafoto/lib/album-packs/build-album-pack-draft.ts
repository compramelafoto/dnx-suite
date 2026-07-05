import type {
  AlbumPack,
  AlbumPackOrderDraftStatus,
  AlbumPackSelectionSession,
  AlbumPackSelectionStatus,
  Prisma,
} from "@/lib/prisma";
import {
  albumPackClientPriceArs,
  albumPackPlatformFeeArs,
} from "@/lib/album-packs/album-pack-client-price";

type SessionPhotoInput = { photoId: number; position?: number | null };

export type AlbumPackForDraftBuild = Pick<
  AlbumPack,
  | "id"
  | "albumId"
  | "name"
  | "price"
  | "includedPhotoCount"
  | "requiresSelection"
  | "requiresDesign"
  | "isActive"
>;

export type AlbumPackSelectionSessionForDraftBuild = Pick<
  AlbumPackSelectionSession,
  | "id"
  | "albumId"
  | "albumPackId"
  | "guestToken"
  | "buyerEmail"
  | "buyerName"
  | "buyerPhone"
  | "status"
> & {
  photos: SessionPhotoInput[];
};

export type AlbumPackDraftSnapshotV1 = {
  type: "ALBUM_PACK_DRAFT_V1";
  packId: string;
  packName: string;
  includedPhotoCount: number | null;
  requiresSelection: boolean;
  requiresDesign: boolean;
  photoIds: number[];
  basePriceArs: number;
  marketplaceFeePercent: number;
  marketplaceFeeCents: number;
  clientTotalArs: number;
  extensionPricingActive?: boolean;
  extensionSurchargeArs?: number;
  createdAt: string;
};

export class AlbumPackOrderDraftBuildError extends Error {
  constructor(message: string, public readonly code: string = "ALBUM_PACK_ORDER_DRAFT_BUILD_ERROR") {
    super(message);
    this.name = "AlbumPackOrderDraftBuildError";
  }
}

function assertSessionReady(status: AlbumPackSelectionStatus): void {
  if (status !== "READY") {
    throw new AlbumPackOrderDraftBuildError(
      "La selección debe estar en estado READY para crear un draft.",
      "SESSION_NOT_READY"
    );
  }
}

function assertPackActive(pack: Pick<AlbumPack, "isActive">): void {
  if (!pack.isActive) {
    throw new AlbumPackOrderDraftBuildError("El pack está inactivo.", "PACK_INACTIVE");
  }
}

function normalizePhotoIds(photos: SessionPhotoInput[]): number[] {
  return photos
    .slice()
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((row) => Number(row.photoId))
    .filter((photoId) => Number.isInteger(photoId) && photoId > 0);
}

export function buildAlbumPackDraft(params: {
  pack: AlbumPackForDraftBuild;
  session: AlbumPackSelectionSessionForDraftBuild;
  platformFeePercent?: number;
  extensionPricingActive?: boolean;
  extensionSurchargeArs?: number;
  now?: Date;
  initialStatus?: AlbumPackOrderDraftStatus;
}): {
  albumId: number;
  albumPackId: string;
  selectionSessionId: string;
  buyerEmail: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  guestToken: string | null;
  status: AlbumPackOrderDraftStatus;
  totalCents: number;
  pricingSnapshotJson: Prisma.InputJsonValue;
} {
  const now = params.now ?? new Date();
  const status = params.initialStatus ?? "DRAFT";
  const { pack, session } = params;

  assertSessionReady(session.status);
  assertPackActive(pack);

  if (session.albumPackId !== pack.id || session.albumId !== pack.albumId) {
    throw new AlbumPackOrderDraftBuildError(
      "La sesión READY no corresponde al pack seleccionado.",
      "SESSION_PACK_MISMATCH"
    );
  }

  const photoIds = normalizePhotoIds(session.photos);
  const basePriceArs = Math.max(0, Math.trunc(Number(pack.price) || 0));
  const marketplaceFeePercent = Math.max(
    0,
    Math.round(Number(params.platformFeePercent) || 0)
  );
  const marketplaceFeeCents = albumPackPlatformFeeArs(basePriceArs, marketplaceFeePercent);
  const clientSubtotalArs = albumPackClientPriceArs(basePriceArs, marketplaceFeePercent);
  const extensionSurchargeArs = Math.max(
    0,
    Math.round(Number(params.extensionSurchargeArs) || 0)
  );
  const extensionPricingActive = Boolean(params.extensionPricingActive && extensionSurchargeArs > 0);
  const clientTotalArs = clientSubtotalArs + extensionSurchargeArs;
  const totalCents = clientTotalArs;

  const pricingSnapshotJson: AlbumPackDraftSnapshotV1 = {
    type: "ALBUM_PACK_DRAFT_V1",
    packId: pack.id,
    packName: pack.name,
    includedPhotoCount: pack.includedPhotoCount ?? null,
    requiresSelection: pack.requiresSelection,
    requiresDesign: pack.requiresDesign,
    photoIds,
    basePriceArs,
    marketplaceFeePercent,
    marketplaceFeeCents,
    clientTotalArs,
    extensionPricingActive: extensionPricingActive || undefined,
    extensionSurchargeArs: extensionSurchargeArs > 0 ? extensionSurchargeArs : undefined,
    createdAt: now.toISOString(),
  };

  return {
    albumId: pack.albumId,
    albumPackId: pack.id,
    selectionSessionId: session.id,
    buyerEmail: session.buyerEmail ?? null,
    buyerName: session.buyerName ?? null,
    buyerPhone: session.buyerPhone ?? null,
    guestToken: session.guestToken ?? null,
    status,
    totalCents,
    pricingSnapshotJson,
  };
}
