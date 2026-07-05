/**
 * Modo auditoría (Paso 13B): compara precio legacy vs `resolveEventDigitalPhotoBasePrice` sin aplicarlo al cobro.
 * Activar logs: EVENT_PHOTO_PRICING_AUDIT=1
 */

import { prisma } from "@/lib/prisma";
import {
  resolveEventDigitalPhotoBasePrice,
  type ResolverAlbumSlice,
  type ResolverCollaborativeEvent,
  type ResolverPhotoSlice,
  type ResolverUserDefaultSlice,
} from "@/lib/pricing/event-digital-photo-price-resolver";

export function isEventPhotoPricingAuditEnabled(): boolean {
  return process.env.EVENT_PHOTO_PRICING_AUDIT === "1";
}

type AuditEmitKind =
  /** Motor de cotización/checkout interno (`computeCheckoutTotals`). */
  | "override_detected"
  /** Respuesta `/api/a/[id]/order-photos` (quote previo). */
  | "quote_override_detected";

/** Campos esperados por operaciones; permite serializar estable en logs. */
type AuditEnvelope = {
  albumId: number;
  eventId: number;
  photoId?: number | null;
  /** Solo checkout: índice del ítem en el carrito. */
  checkoutInputIndex?: number;
  currentResolvedBasePrice: number;
  eventResolvedBasePrice: number;
  appliedRule: string;
  reason: string;
};

function emitAudit(kind: AuditEmitKind, payload: AuditEnvelope): void {
  console.info(`[event-photo-pricing:audit] ${kind}`, payload);
}

/**
 * Ejecuta el resolver contra el legacy y emite UN log sólo si el flag está activo
 * y `didOverrideCurrentPrice` es true.
 */
export function logEventDigitalPhotoPricingAuditDifference(params: {
  kind: AuditEmitKind;
  albumId: number;
  eventId: number;
  collaborativeEvent: ResolverCollaborativeEvent;
  /** Precio legacy en pesos ya resuelto (igual que hoy cobra/discrimina checkout). */
  legacyBasePricePesos: number;
  album: ResolverAlbumSlice | null | undefined;
  albumOwnerUser?: ResolverUserDefaultSlice | null;
  uploaderUser?: ResolverUserDefaultSlice | null;
  photo?: ResolverPhotoSlice | null;
  photoId?: number | null;
  checkoutInputIndex?: number;
  globalMinimumPrice?: number | null;
}): void {
  if (!isEventPhotoPricingAuditEnabled()) return;

  const current = Number(params.legacyBasePricePesos);
  const currentResolvedBasePrice =
    Number.isFinite(current) && current >= 0 ? current : 0;

  const resolution = resolveEventDigitalPhotoBasePrice({
    album: params.album ?? undefined,
    event: params.collaborativeEvent,
    currentResolvedBasePrice,
    albumOwnerUser: params.albumOwnerUser ?? undefined,
    uploaderUser: params.uploaderUser ?? undefined,
    photo: params.photo ?? undefined,
    globalMinimumPrice: params.globalMinimumPrice,
  });

  if (!resolution.didOverrideCurrentPrice) return;

  const envelope: AuditEnvelope = {
    albumId: params.albumId,
    eventId: params.eventId,
    photoId: params.photoId,
    checkoutInputIndex: params.checkoutInputIndex,
    currentResolvedBasePrice,
    eventResolvedBasePrice: resolution.basePrice,
    appliedRule: resolution.appliedRule,
    reason: resolution.reason,
  };

  emitAudit(params.kind, envelope);
}

export async function fetchCollaborativeEventPricingForAudit(
  eventId: number
): Promise<ResolverCollaborativeEvent | null> {
  return prisma.event.findUnique({
    where: { id: eventId },
    select: {
      photoPricingMode: true,
      fixedPhotoPrice: true,
      minimumPhotoPrice: true,
    },
  });
}
