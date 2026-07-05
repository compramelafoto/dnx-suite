import { EventPhotoPricingMode } from "@/lib/prisma";

/** @deprecated Persistido para eventos legacy; no usar en alta ni cambiar otros modos hacia este. Resolver/checkout mantienen compatibilidad. */
export const LEGACY_ORGANIZER_MINIMUM_MODE = EventPhotoPricingMode.ORGANIZER_MINIMUM;

/** Precio mínimo en pesos ARS para modo fijo (y validación legacy mínimo solo en DB vieja). */
export const MIN_EVENT_PHOTO_PRICE_ARS = 1;

/** Tope superior razonable en pesos ARS (evita errores de carga). */
export const MAX_EVENT_PHOTO_PRICE_ARS = 50_000_000;

const MODE_SET = new Set<string>(Object.values(EventPhotoPricingMode));

export function parseEventPhotoPricingMode(raw: unknown): EventPhotoPricingMode | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!MODE_SET.has(s)) return null;
  return s as EventPhotoPricingMode;
}

/** Interpreta número en pesos desde UI/API (acepta coma decimal). */
export function parsePricePesos(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const n =
    typeof raw === "number"
      ? raw
      : parseFloat(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

export type NormalizedEventPhotoPricing = {
  photoPricingMode: EventPhotoPricingMode;
  fixedPhotoPrice: number | null;
  minimumPhotoPrice: number | null;
};

function validatePriceValue(label: string, n: number | null): string | null {
  if (n == null) return `${label} es requerido.`;
  if (n < MIN_EVENT_PHOTO_PRICE_ARS) {
    return `${label} debe ser al menos $${MIN_EVENT_PHOTO_PRICE_ARS.toLocaleString("es-AR")}.`;
  }
  if (n > MAX_EVENT_PHOTO_PRICE_ARS) {
    return `${label} supera el máximo permitido (${MAX_EVENT_PHOTO_PRICE_ARS.toLocaleString("es-AR")} ARS).`;
  }
  return null;
}

/**
 * Valida y normaliza modo + montos: limpia campos que no aplican al modo.
 */
export function normalizeEventPhotoPricing(input: {
  mode: EventPhotoPricingMode;
  fixedPhotoPrice: number | null | undefined;
  minimumPhotoPrice: number | null | undefined;
}): { ok: true; value: NormalizedEventPhotoPricing } | { ok: false; error: string } {
  const { mode } = input;

  if (mode === EventPhotoPricingMode.PHOTOGRAPHER_DECIDES) {
    return {
      ok: true,
      value: {
        photoPricingMode: mode,
        fixedPhotoPrice: null,
        minimumPhotoPrice: null,
      },
    };
  }

  if (mode === EventPhotoPricingMode.ORGANIZER_FIXED) {
    const fixed =
      input.fixedPhotoPrice === undefined ? null : input.fixedPhotoPrice;
    /** null = modo oficial activado sin carta cargada aún (se completa en panel dedicado). */
    if (fixed == null) {
      return {
        ok: true,
        value: {
          photoPricingMode: mode,
          fixedPhotoPrice: null,
          minimumPhotoPrice: null,
        },
      };
    }
    const err = validatePriceValue("El precio fijo por foto", fixed);
    if (err) return { ok: false, error: err };
    return {
      ok: true,
      value: {
        photoPricingMode: mode,
        fixedPhotoPrice: fixed,
        minimumPhotoPrice: null,
      },
    };
  }

  if (mode === EventPhotoPricingMode.ORGANIZER_MINIMUM) {
    const min =
      input.minimumPhotoPrice === undefined ? null : input.minimumPhotoPrice;
    const err = validatePriceValue("El precio mínimo por foto", min);
    if (err) return { ok: false, error: err };
    return {
      ok: true,
      value: {
        photoPricingMode: mode,
        fixedPhotoPrice: null,
        minimumPhotoPrice: min,
      },
    };
  }

  return { ok: false, error: "Modo de precios inválido." };
}

/** Alta de evento: default PHOTOGRAPHER_DECIDES si no mandan modo. */
export function resolveEventPhotoPricingForCreate(body: {
  photoPricingMode?: unknown;
  fixedPhotoPrice?: unknown;
  minimumPhotoPrice?: unknown;
}): { ok: true; value: NormalizedEventPhotoPricing } | { ok: false; error: string } {
  const mode =
    parseEventPhotoPricingMode(body.photoPricingMode) ??
    EventPhotoPricingMode.PHOTOGRAPHER_DECIDES;
  if (mode === EventPhotoPricingMode.ORGANIZER_MINIMUM) {
    return {
      ok: false,
      error:
        'La regla "precio mínimo" ya no está disponible para eventos nuevos. Elegí si cada fotógrafo define su venta digital o precios digitales oficiales del evento.',
    };
  }
  const fixedRaw = parsePricePesos(body.fixedPhotoPrice);
  const minRaw = parsePricePesos(body.minimumPhotoPrice);
  return normalizeEventPhotoPricing({
    mode,
    fixedPhotoPrice: fixedRaw === undefined ? null : fixedRaw,
    minimumPhotoPrice: minRaw === undefined ? null : minRaw,
  });
}

/** PATCH: combina body parcial con valores actuales del evento. */
export function eventPhotoPricingFieldsTouched(body: {
  photoPricingMode?: unknown;
  fixedPhotoPrice?: unknown;
  minimumPhotoPrice?: unknown;
}): boolean {
  return (
    body.photoPricingMode !== undefined ||
    body.fixedPhotoPrice !== undefined ||
    body.minimumPhotoPrice !== undefined
  );
}

export function resolveEventPhotoPricingForPatch(
  current: {
    photoPricingMode: EventPhotoPricingMode;
    fixedPhotoPrice: number | null;
    minimumPhotoPrice: number | null;
  },
  body: {
    photoPricingMode?: unknown;
    fixedPhotoPrice?: unknown;
    minimumPhotoPrice?: unknown;
  }
): { ok: true; value: NormalizedEventPhotoPricing } | { ok: false; error: string } {
  const mode =
    body.photoPricingMode !== undefined
      ? parseEventPhotoPricingMode(body.photoPricingMode)
      : null;

  /** No admitir seleccionar / conservar modo mínimo salvo estado ya persistido (solo lectura hasta migrar el evento). */
  if (
    mode === EventPhotoPricingMode.ORGANIZER_MINIMUM &&
    current.photoPricingMode !== EventPhotoPricingMode.ORGANIZER_MINIMUM
  ) {
    return {
      ok: false,
      error:
        'El modo "precio mínimo" ya no está disponible. Elegí si cada fotógrafo define su venta digital o precios digitales oficiales del evento.',
    };
  }

  const nextMode = mode ?? current.photoPricingMode;

  let nextFixed = current.fixedPhotoPrice;
  if (body.fixedPhotoPrice !== undefined) {
    const p = parsePricePesos(body.fixedPhotoPrice);
    nextFixed = p === undefined ? current.fixedPhotoPrice : p;
  }

  let nextMin = current.minimumPhotoPrice;
  if (body.minimumPhotoPrice !== undefined) {
    const p = parsePricePesos(body.minimumPhotoPrice);
    nextMin = p === undefined ? current.minimumPhotoPrice : p;
  }

  return normalizeEventPhotoPricing({
    mode: nextMode,
    fixedPhotoPrice: nextFixed,
    minimumPhotoPrice: nextMin,
  });
}

export function eventPhotoPricingPhotoPickerLine(value: NormalizedEventPhotoPricing): string {
  const lines = eventPhotoPricingEnrollmentCopy(value).summaryLines.filter(Boolean);
  return lines.join(" ");
}

/** Textos públicos antes de sumarse al evento (/e/[shareSlug]). */
export type EventPricingEnrollmentCopy = {
  /** Líneas mostradas como bloques (no combinar todas en una si el consumidor muestra párrafos). */
  summaryLines: string[];
  /** Una sola línea para layouts que solo muestran un string. */
  compactLine?: string | null;
  acceptanceNote?: string | null;
};

export function eventPhotoPricingEnrollmentCopy(
  value: NormalizedEventPhotoPricing
): EventPricingEnrollmentCopy {
  const money = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  switch (value.photoPricingMode) {
    case EventPhotoPricingMode.PHOTOGRAPHER_DECIDES:
      return {
        summaryLines: ["Venta digital: cada fotógrafo define sus precios."],
        acceptanceNote: null,
      };
    case EventPhotoPricingMode.ORGANIZER_FIXED: {
      const parts = [
        "Precios oficiales del evento: el organizador define la venta digital para todos los fotógrafos.",
      ];
      if (value.fixedPhotoPrice != null && value.fixedPhotoPrice > 0) {
        parts.push(`Foto digital individual: ${money.format(value.fixedPhotoPrice)}`);
      } else {
        parts.push(
          "Los montos de la venta digital oficial se van a publicar cuando el organizador los configure en el panel del evento."
        );
      }
      return {
        summaryLines: parts,
        acceptanceNote:
          "Al sumarte aceptás vender las fotos digitales con los precios oficiales definidos por el organizador; los cambios aplican sólo a ventas futuras.",
      };
    }
    case EventPhotoPricingMode.ORGANIZER_MINIMUM: {
      // Legacy DB: comportamiento igual que antes en checkout; texto actualizado sólo donde haga falta.
      const legacyLine =
        value.minimumPhotoPrice != null && value.minimumPhotoPrice > 0
          ? `Este evento aún tiene regla anterior: precio mínimo oficial ${money.format(
              value.minimumPhotoPrice
            )} por foto digital; los fotógrafos pueden cobrar más salvo otros acuerdos.`
          : "Este evento aún tiene una regla anterior de precios (mínimo por foto). Confirmá los detalles con el organizador.";
      return {
        summaryLines: [legacyLine],
        acceptanceNote: null,
      };
    }
    default:
      return {
        summaryLines: ["Venta digital: cada fotógrafo define sus precios."],
        acceptanceNote: null,
      };
  }
}

export function eventPhotoPricingOrganizerSummary(value: NormalizedEventPhotoPricing): string {
  const money = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
  switch (value.photoPricingMode) {
    case EventPhotoPricingMode.PHOTOGRAPHER_DECIDES:
      return "Venta digital: cada fotógrafo define sus precios.";
    case EventPhotoPricingMode.ORGANIZER_FIXED:
      return value.fixedPhotoPrice != null && value.fixedPhotoPrice > 0
        ? `Precios digitales oficiales del evento. Foto individual: ${money.format(value.fixedPhotoPrice)}.`
        : "Precios digitales oficiales del evento — completá los montos en la sección del evento cuando esté disponible.";
    case EventPhotoPricingMode.ORGANIZER_MINIMUM:
      return value.minimumPhotoPrice != null && value.minimumPhotoPrice > 0
        ? `Regla anterior (precio mínimo): desde ${money.format(value.minimumPhotoPrice)} por foto digital.`
        : "Regla anterior de precio mínimo (legacy). Actualizalo a uno de los modos vigentes cuando puedas.";
    default:
      return "Venta digital: cada fotógrafo define sus precios.";
  }
}

export function normalizedPricingFromEventDb(event: {
  photoPricingMode?: EventPhotoPricingMode | string | null;
  fixedPhotoPrice?: number | null;
  minimumPhotoPrice?: number | null;
}): NormalizedEventPhotoPricing {
  const modeRaw = event.photoPricingMode;
  const mode =
    modeRaw === EventPhotoPricingMode.ORGANIZER_FIXED ||
    modeRaw === EventPhotoPricingMode.ORGANIZER_MINIMUM ||
    modeRaw === EventPhotoPricingMode.PHOTOGRAPHER_DECIDES
      ? modeRaw
      : EventPhotoPricingMode.PHOTOGRAPHER_DECIDES;
  const res = normalizeEventPhotoPricing({
    mode,
    fixedPhotoPrice: event.fixedPhotoPrice ?? null,
    minimumPhotoPrice: event.minimumPhotoPrice ?? null,
  });
  if (!res.ok) {
    return {
      photoPricingMode: EventPhotoPricingMode.PHOTOGRAPHER_DECIDES,
      fixedPhotoPrice: null,
      minimumPhotoPrice: null,
    };
  }
  return res.value;
}
