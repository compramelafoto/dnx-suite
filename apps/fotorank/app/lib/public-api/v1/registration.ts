/**
 * Inscripción pública (Etapa 09B1 — oferta pública).
 *
 * - resolvePublicRegistrationState: fuente única del estado
 * - serializePublicRegistrationV1: bloque API
 * - URLs de handoff + retorno seguro
 * - formato de moneda (unidades mínimas)
 * - checkoutUrl siempre null hasta integración DNX Payments (09B2)
 */

import type {
  FotorankPublicDisplayPriceV1,
  FotorankPublicEventStatusV1,
  FotorankPublicRegistrationPricingModeV1,
  FotorankPublicRegistrationStatusV1,
  FotorankPublicRegistrationV1,
} from "./contracts";
import { toIsoOrNull } from "./status";

export type InternalRegistrationPricingMode = "FREE" | "PAID" | "INVITATION_ONLY" | null;

export type PublicRegistrationConfigSource = {
  slug: string;
  eventStatus: FotorankPublicEventStatusV1;
  registrationEnabled: boolean;
  pricingMode: InternalRegistrationPricingMode;
  priceAmountMinor: number | null;
  currency: string | null;
  opensAt: Date | null;
  closesAt: Date | null;
  /** Fallback: submissionDeadline del concurso si no hay closesAt. */
  submissionDeadline: Date | null;
  /** Fallback: startAt del concurso si no hay opensAt. */
  eventStartAt: Date | null;
  capacity: number | null;
  /** Conteos públicos fiables; null = no exponer remainingSpots. */
  confirmedCount: number | null;
  hasOptionalMerchandise: boolean;
};

export type ResolvePublicRegistrationStateInput = {
  now?: Date;
  eventStatus: FotorankPublicEventStatusV1;
  registrationEnabled: boolean;
  opensAt: Date | null;
  closesAt: Date | null;
  submissionDeadline: Date | null;
  eventStartAt: Date | null;
  capacity: number | null;
  confirmedCount: number | null;
  /**
   * Cancelación explícita del evento (aún sin status Prisma CANCELLED).
   * Reservado para señal futura; loaders no lo setean hoy.
   */
  isCancelled?: boolean;
};

/**
 * Fuente única del estado público de inscripción.
 * No repetir en serializers de UI ni en Clickaton.
 */
export function resolvePublicRegistrationState(
  input: ResolvePublicRegistrationStateInput,
): FotorankPublicRegistrationStatusV1 {
  const now = input.now ?? new Date();

  if (input.isCancelled) return "cancelled";
  if (input.eventStatus === "archived") return "finished";
  if (input.eventStatus === "closed") return "closed";
  if (input.eventStatus === "draft") return "not_open";

  if (!input.registrationEnabled) return "not_open";

  const opensAt = input.opensAt ?? input.eventStartAt;
  const closesAt = input.closesAt ?? input.submissionDeadline;

  if (opensAt && opensAt.getTime() > now.getTime()) return "not_open";
  if (closesAt && closesAt.getTime() < now.getTime()) return "closed";

  if (
    input.capacity != null &&
    input.capacity > 0 &&
    input.confirmedCount != null &&
    input.confirmedCount >= input.capacity
  ) {
    return "full";
  }

  if (opensAt || closesAt || input.registrationEnabled) return "open";
  return "unknown";
}

/** Fraction digits por moneda (no asumir siempre 2). */
export function currencyFractionDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: currency.toUpperCase(),
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

export function formatMoneyMinor(
  amountMinor: number,
  currency: string,
  locale = "es-AR",
): string {
  const digits = currencyFractionDigits(currency);
  const major = amountMinor / 10 ** digits;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(major);
  } catch {
    return `${major.toFixed(digits)} ${currency.toUpperCase()}`;
  }
}

export function buildDisplayPriceV1(
  amountMinor: number | null,
  currency: string | null,
  mode: FotorankPublicRegistrationPricingModeV1,
): FotorankPublicDisplayPriceV1 | null {
  if (mode !== "paid") return null;
  if (amountMinor == null || amountMinor <= 0 || !currency?.trim()) return null;
  const cur = currency.trim().toUpperCase();
  return {
    amountMinor,
    currency: cur,
    formatted: formatMoneyMinor(amountMinor, cur),
  };
}

export function assertSafePublicWebBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("FOTORANK_PUBLIC_WEB_BASE_URL is not a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("FOTORANK_PUBLIC_WEB_BASE_URL must use http or https");
  }
  if (parsed.username || parsed.password) {
    throw new Error("FOTORANK_PUBLIC_WEB_BASE_URL must not include credentials");
  }
  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
}

/**
 * Valida returnTo / origen hacia Clickatón.
 * Solo http(s), sin credenciales, opcionalmente restringido a un origen permitido.
 */
export function isSafeClickatonReturnTo(
  value: string | null | undefined,
  allowedOrigin: string | null | undefined,
): boolean {
  if (value == null || value.trim() === "") return false;
  const raw = value.trim();
  if (
    raw.startsWith("javascript:") ||
    raw.startsWith("data:") ||
    raw.startsWith("file:") ||
    raw.startsWith("//")
  ) {
    return false;
  }
  // Ruta relativa segura
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return !raw.includes("\\") && !raw.includes("@");
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (!allowedOrigin) return false;
    const allowed = new URL(allowedOrigin);
    return url.origin === allowed.origin;
  } catch {
    return false;
  }
}

export type BuildRegistrationHandoffUrlInput = {
  webBaseUrl: string;
  slug: string;
  source?: "clickaton";
  returnTo?: string | null;
  clickatonOrigin?: string | null;
};

/**
 * Handoff a landing pública FR (ruta real existente).
 * `/concursos/{slug}?source=clickaton[&returnTo=...]`
 */
export function buildRegistrationHandoffUrl(
  input: BuildRegistrationHandoffUrlInput,
): string | null {
  let base: string;
  try {
    base = assertSafePublicWebBaseUrl(input.webBaseUrl);
  } catch {
    return null;
  }
  const slug = input.slug.trim();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) return null;

  const url = new URL(`${base}/concursos/${encodeURIComponent(slug)}`);
  if (input.source) url.searchParams.set("source", input.source);
  if (
    input.returnTo &&
    isSafeClickatonReturnTo(input.returnTo, input.clickatonOrigin ?? null)
  ) {
    url.searchParams.set("returnTo", input.returnTo);
  }
  return url.toString();
}

export function getFotorankPublicWebBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const candidates = [
    env.FOTORANK_PUBLIC_WEB_BASE_URL,
    env.FOTORANK_PUBLIC_API_BASE_URL,
    env.APP_URL,
    env.NEXT_PUBLIC_APP_URL,
    env.NEXT_PUBLIC_FOTORANK_URL,
  ];
  for (const raw of candidates) {
    const value = raw?.trim();
    if (!value) continue;
    try {
      return assertSafePublicWebBaseUrl(value);
    } catch {
      continue;
    }
  }
  return null;
}

export function mapInternalPricingModeToPublic(
  mode: InternalRegistrationPricingMode,
): FotorankPublicRegistrationPricingModeV1 | null {
  if (mode === "FREE") return "free";
  if (mode === "PAID") return "paid";
  return null;
}

export type SerializePublicRegistrationV1Options = {
  now?: Date;
  webBaseUrl?: string | null;
  clickatonOrigin?: string | null;
  source?: "clickaton";
  /** Si true, construye returnTo hacia /maratones/{slug} en Clickatón. */
  includeReturnTo?: boolean;
};

/**
 * Serializa el bloque `registration` para listado/detalle.
 * Ante config inconsistente (paid sin precio/moneda): canRegister=false, sin CTA operativo.
 */
export function serializePublicRegistrationV1(
  source: PublicRegistrationConfigSource,
  options?: SerializePublicRegistrationV1Options,
): FotorankPublicRegistrationV1 {
  const opensAt = source.opensAt ?? source.eventStartAt;
  const closesAt = source.closesAt ?? source.submissionDeadline;

  const status = resolvePublicRegistrationState({
    now: options?.now,
    eventStatus: source.eventStatus,
    registrationEnabled: source.registrationEnabled,
    opensAt: source.opensAt,
    closesAt: source.closesAt,
    submissionDeadline: source.submissionDeadline,
    eventStartAt: source.eventStartAt,
    capacity: source.capacity,
    confirmedCount: source.confirmedCount,
  });

  const pricingMode =
    mapInternalPricingModeToPublic(source.pricingMode) ?? "free";

  const displayPrice = buildDisplayPriceV1(
    source.priceAmountMinor,
    source.currency,
    pricingMode,
  );

  const paidIncomplete =
    pricingMode === "paid" &&
    (displayPrice == null ||
      source.priceAmountMinor == null ||
      source.priceAmountMinor <= 0 ||
      !source.currency?.trim());

  const webBase =
    options?.webBaseUrl ?? getFotorankPublicWebBaseUrl() ?? null;

  const returnTo = options?.includeReturnTo
    ? options.clickatonOrigin
      ? `${options.clickatonOrigin.replace(/\/+$/, "")}/maratones/${encodeURIComponent(source.slug)}`
      : `/maratones/${encodeURIComponent(source.slug)}`
    : null;

  const registrationUrl =
    webBase && source.registrationEnabled
      ? buildRegistrationHandoffUrl({
          webBaseUrl: webBase,
          slug: source.slug,
          source: options?.source,
          returnTo,
          clickatonOrigin: options?.clickatonOrigin ?? null,
        })
      : null;

  const statusAllowsRegister = status === "open";
  const canRegister =
    Boolean(source.registrationEnabled) &&
    statusAllowsRegister &&
    !paidIncomplete &&
    Boolean(registrationUrl);

  // 09B1: sin checkout real. Cobro futuro vía DNX Payments (09B2).
  const checkoutUrl: string | null = null;

  let remainingSpots: number | null = null;
  if (
    source.capacity != null &&
    source.capacity > 0 &&
    source.confirmedCount != null &&
    source.confirmedCount >= 0
  ) {
    remainingSpots = Math.max(0, source.capacity - source.confirmedCount);
  }

  return {
    mode: pricingMode,
    status,
    canRegister,
    displayPrice: pricingMode === "free" ? null : displayPrice,
    hasOptionalMerchandise: Boolean(source.hasOptionalMerchandise),
    registrationUrl,
    checkoutUrl,
    opensAt: toIsoOrNull(opensAt),
    closesAt: toIsoOrNull(closesAt),
    capacity: source.capacity != null && source.capacity > 0 ? source.capacity : null,
    remainingSpots,
  };
}

/** @deprecated Preferir serializePublicRegistrationV1 */
export function buildPublicRegistrationStubV1(input: {
  registrationStatus: FotorankPublicRegistrationStatusV1;
  capabilities: { canRegister: boolean };
}): FotorankPublicRegistrationV1 {
  return {
    mode: "free",
    status: input.registrationStatus,
    canRegister: false,
    displayPrice: null,
    hasOptionalMerchandise: false,
    registrationUrl: null,
    checkoutUrl: null,
    opensAt: null,
    closesAt: null,
    capacity: null,
    remainingSpots: null,
  };
}
