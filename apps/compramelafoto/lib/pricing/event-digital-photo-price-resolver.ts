/**
 * Resolver central del precio base digital por foto para álbumes con evento colaborativo (Paso 13A).
 *
 * Solo expone una función pura — no está cableado al checkout hasta el Paso 13B.
 *
 * Ejemplos rápidos (montos en pesos ARS; el campo DB `digitalPhotoPriceCents` también es pesos):
 *
 * 1) Sin evento: input.currentResolvedBasePrice = 5000 → igual salida,
 *    appliedRule CURRENT_BEHAVIOR, reason "no_event".
 *
 * 2) Evento PHOTOGRAPHER_DECIDES: currentResolvedBasePrice conservado,
 *    appliedRule PHOTOGRAPHER_DECIDES.
 *
 * 3) ORGANIZER_FIXED, fixedPhotoPrice válido (= 4200): basePrice 4200,
 *    appliedRule ORGANIZER_FIXED, didOverride si difiere de currentResolvedBasePrice.
 *
 * 4) ORGANIZER_MINIMUM, minimum 3000, current 2500 → basePrice 3000;
 *    didOverride true solo si el resultado final es mayor que el precio legacy actual (incl. piso global).
 *
 * 5) Modo FIXED pero fixed inválido (null/Cero/fuera de rango DB): igual a currentResolvedBasePrice,
 *    appliedRule CURRENT_BEHAVIOR, reason invalid_event_pricing_config.
 *
 * Prueba manual: `npx tsx scripts/event-digital-photo-price-resolver-smoke.ts`
 */

import { EventPhotoPricingMode } from "@/lib/prisma";
import { normalizeEventPhotoPricing } from "@/lib/event-photo-pricing";

export type EventDigitalPhotoPriceAppliedRule =
  | "CURRENT_BEHAVIOR"
  | "PHOTOGRAPHER_DECIDES"
  | "ORGANIZER_FIXED"
  | "ORGANIZER_MINIMUM";

export type EventDigitalPhotoPriceSource =
  | "album"
  | "uploader_default"
  | "event_fixed"
  | "event_minimum"
  | "global_minimum"
  | "fallback";

export type EventDigitalPhotoBasePriceResolution = {
  basePrice: number;
  appliedRule: EventDigitalPhotoPriceAppliedRule;
  source: EventDigitalPhotoPriceSource;
  didOverrideCurrentPrice: boolean;
  reason: string;
};

export type ResolverCollaborativeEvent = {
  photoPricingMode: EventPhotoPricingMode;
  fixedPhotoPrice?: number | null;
  minimumPhotoPrice?: number | null;
};

export type ResolverAlbumSlice = {
  digitalPhotoPriceCents?: number | null;
};

export type ResolverUserDefaultSlice = {
  defaultDigitalPhotoPrice?: number | null;
};

/** Campos reservados para Paso 13B / auditoría (hoy ignorados por la función). */
export type ResolverPhotoSlice = Record<string, unknown>;

export type ResolveEventDigitalPhotoBasePriceInput = {
  album?: ResolverAlbumSlice | null;
  event?: ResolverCollaborativeEvent | null;
  photo?: ResolverPhotoSlice | null;
  uploaderUser?: ResolverUserDefaultSlice | null;
  albumOwnerUser?: ResolverUserDefaultSlice | null;
  /** Precio base ya computado por el flujo legacy (pesos ARS). */
  currentResolvedBasePrice: number;
  /** Precio mínimo de plataforma / config global (opcional; sólo modo organizador FIXED/MÍNIMO). */
  globalMinimumPrice?: number | null;
};

function almostEqualPesos(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-6;
}

function inferPassiveSource(params: {
  currentResolvedBasePrice: number;
  album?: ResolverAlbumSlice | null;
  albumOwnerUser?: ResolverUserDefaultSlice | null;
  uploaderUser?: ResolverUserDefaultSlice | null;
}): EventDigitalPhotoPriceSource {
  const { currentResolvedBasePrice, album, albumOwnerUser, uploaderUser } = params;
  const albumStored =
    typeof album?.digitalPhotoPriceCents === "number" &&
    Number.isFinite(album.digitalPhotoPriceCents)
      ? album.digitalPhotoPriceCents
      : null;
  if (
    albumStored !== null &&
    albumStored >= 0 &&
    almostEqualPesos(currentResolvedBasePrice, albumStored)
  ) {
    return "album";
  }

  const ownerDefault =
    typeof albumOwnerUser?.defaultDigitalPhotoPrice === "number" &&
    Number.isFinite(albumOwnerUser.defaultDigitalPhotoPrice)
      ? albumOwnerUser.defaultDigitalPhotoPrice
      : null;
  if (
    ownerDefault !== null &&
    ownerDefault >= 0 &&
    almostEqualPesos(currentResolvedBasePrice, ownerDefault)
  ) {
    return "uploader_default";
  }

  const uploaderDefault =
    typeof uploaderUser?.defaultDigitalPhotoPrice === "number" &&
    Number.isFinite(uploaderUser.defaultDigitalPhotoPrice)
      ? uploaderUser.defaultDigitalPhotoPrice
      : null;
  if (
    uploaderDefault !== null &&
    uploaderDefault >= 0 &&
    almostEqualPesos(currentResolvedBasePrice, uploaderDefault)
  ) {
    return "uploader_default";
  }

  return "fallback";
}

function mergeGlobalMinimumFloor(params: {
  baseAfterOrganizerRules: number;
  globalMinimumPrice?: number | null;
  organizerSource: Extract<
    EventDigitalPhotoPriceSource,
    "event_fixed" | "event_minimum"
  >;
}): { basePrice: number; source: EventDigitalPhotoPriceSource } {
  const g =
    typeof params.globalMinimumPrice === "number" &&
    Number.isFinite(params.globalMinimumPrice)
      ? params.globalMinimumPrice
      : null;
  if (g !== null && g > 0 && params.baseAfterOrganizerRules < g - 1e-9) {
    return { basePrice: g, source: "global_minimum" };
  }
  return {
    basePrice: params.baseAfterOrganizerRules,
    source: params.organizerSource,
  };
}

/**
 * Resuelve el precio base digital sugerido según política del evento colaborativo, sin efectos secundarios.
 * No debe usarse en checkout hasta integrar Paso 13B; hoy sirve auditoría/tests.
 */
export function resolveEventDigitalPhotoBasePrice(
  input: ResolveEventDigitalPhotoBasePriceInput
): EventDigitalPhotoBasePriceResolution {
  const currentRaw = Number(input.currentResolvedBasePrice);
  const currentResolvedBasePrice =
    Number.isFinite(currentRaw) && currentRaw >= 0 ? currentRaw : 0;

  if (!input.event) {
    const source = inferPassiveSource({
      currentResolvedBasePrice,
      album: input.album ?? undefined,
      albumOwnerUser: input.albumOwnerUser ?? undefined,
      uploaderUser: input.uploaderUser ?? undefined,
    });
    return {
      basePrice: currentResolvedBasePrice,
      appliedRule: "CURRENT_BEHAVIOR",
      source,
      didOverrideCurrentPrice: false,
      reason: "no_event",
    };
  }

  const normalized = normalizeEventPhotoPricing({
    mode: input.event.photoPricingMode,
    fixedPhotoPrice: input.event.fixedPhotoPrice,
    minimumPhotoPrice: input.event.minimumPhotoPrice,
  });

  if (!normalized.ok) {
    const reason = `invalid_event_pricing_config: ${normalized.error}`;
    const source = inferPassiveSource({
      currentResolvedBasePrice,
      album: input.album ?? undefined,
      albumOwnerUser: input.albumOwnerUser ?? undefined,
      uploaderUser: input.uploaderUser ?? undefined,
    });
    return {
      basePrice: currentResolvedBasePrice,
      appliedRule: "CURRENT_BEHAVIOR",
      source,
      didOverrideCurrentPrice: false,
      reason,
    };
  }

  const { photoPricingMode, fixedPhotoPrice, minimumPhotoPrice } = normalized.value;

  if (photoPricingMode === EventPhotoPricingMode.PHOTOGRAPHER_DECIDES) {
    const source = inferPassiveSource({
      currentResolvedBasePrice,
      album: input.album ?? undefined,
      albumOwnerUser: input.albumOwnerUser ?? undefined,
      uploaderUser: input.uploaderUser ?? undefined,
    });
    return {
      basePrice: currentResolvedBasePrice,
      appliedRule: "PHOTOGRAPHER_DECIDES",
      source,
      didOverrideCurrentPrice: false,
      reason: "photographer_decides",
    };
  }

  if (photoPricingMode === EventPhotoPricingMode.ORGANIZER_FIXED) {
    const fixed =
      typeof fixedPhotoPrice === "number" && Number.isFinite(fixedPhotoPrice)
        ? fixedPhotoPrice
        : null;

    if (fixed === null || !(fixed > 0)) {
      const source = inferPassiveSource({
        currentResolvedBasePrice,
        album: input.album ?? undefined,
        albumOwnerUser: input.albumOwnerUser ?? undefined,
        uploaderUser: input.uploaderUser ?? undefined,
      });
      return {
        basePrice: currentResolvedBasePrice,
        appliedRule: "CURRENT_BEHAVIOR",
        source,
        didOverrideCurrentPrice: false,
        reason: "invalid_event_pricing_config: organizer_fixed_missing_price",
      };
    }

    const merged = mergeGlobalMinimumFloor({
      baseAfterOrganizerRules: fixed,
      globalMinimumPrice: input.globalMinimumPrice,
      organizerSource: "event_fixed",
    });

    return {
      basePrice: merged.basePrice,
      appliedRule: "ORGANIZER_FIXED",
      source: merged.source,
      didOverrideCurrentPrice: !almostEqualPesos(
        merged.basePrice,
        currentResolvedBasePrice
      ),
      reason:
        merged.source === "global_minimum"
          ? "organizer_fixed_then_global_floor"
          : "organizer_fixed_applied",
    };
  }

  /** ORGANIZER_MINIMUM persistido solo en DB legacy: mismo cálculo que siempre para no alterar cobros/checkout de esos eventos. */
  if (photoPricingMode === EventPhotoPricingMode.ORGANIZER_MINIMUM) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[event-digital-photo-price-resolver] ORGANIZER_MINIMUM (deprecado en UI nueva; conservando compatibilidad)."
      );
    }
  }

  const min =
    typeof minimumPhotoPrice === "number" && Number.isFinite(minimumPhotoPrice)
      ? minimumPhotoPrice
      : null;
  if (min === null || !(min > 0)) {
    const source = inferPassiveSource({
      currentResolvedBasePrice,
      album: input.album ?? undefined,
      albumOwnerUser: input.albumOwnerUser ?? undefined,
      uploaderUser: input.uploaderUser ?? undefined,
    });
    return {
      basePrice: currentResolvedBasePrice,
      appliedRule: "CURRENT_BEHAVIOR",
      source,
      didOverrideCurrentPrice: false,
      reason: "invalid_event_pricing_config: organizer_minimum_missing_price",
    };
  }

  const afterMinimum = Math.max(currentResolvedBasePrice, min);
  const merged = mergeGlobalMinimumFloor({
    baseAfterOrganizerRules: afterMinimum,
    globalMinimumPrice: input.globalMinimumPrice,
    organizerSource: "event_minimum",
  });

  return {
    basePrice: merged.basePrice,
    appliedRule: "ORGANIZER_MINIMUM",
    source: merged.source,
    /** Sólo “subida” vs el legacy: no marca override si no cambia final. */
    didOverrideCurrentPrice: merged.basePrice > currentResolvedBasePrice + 1e-9,
    reason:
      merged.source === "global_minimum"
        ? "organizer_minimum_then_global_floor"
        : "organizer_minimum_applied",
  };
}
