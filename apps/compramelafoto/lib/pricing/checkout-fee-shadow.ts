/**
 * Shadow mode Fase 1.6 — compara fee legacy vs canónico sin alterar checkout/MP/orders.
 *
 * Habilitar en staging:
 *   CHECKOUT_FEE_SHADOW_MODE=true
 */
import { feeFromBase, feeFromTotal } from "@/lib/pricing/fee-formula";
import type {
  CheckoutFeeComponent,
  CheckoutFeeFlow,
  CheckoutFeePurpose,
  ResolveCheckoutFeePercentInput,
} from "@/lib/pricing/checkout-fee-types";

export const CHECKOUT_FEE_SHADOW_LOG_TAG = "[checkout-fee-shadow-divergence]";

export type CheckoutFeeShadowLogPayload = {
  site: string;
  flow: CheckoutFeeFlow;
  component: CheckoutFeeComponent;
  purpose: CheckoutFeePurpose;
  legacyFeePercent: number;
  canonicalFeePercent: number;
  diffPercent: number;
  estimatedDiffArs: number | null;
  albumId: number | null;
  orderId: number | null;
  hasPrintItems: boolean;
  hasOrganizer: boolean;
  hasReferral: boolean;
  labId: number | null;
  photographerId: number | null;
};

export type CheckoutFeeShadowCompareInput = {
  /** Punto de instrumentación (ej. `pricing-engine.digital-line`). */
  site: string;
  /** % fee que usa hoy el código productivo en este punto. */
  legacyFeePercent: number;
  resolveInput: ResolveCheckoutFeePercentInput;
  albumId?: number | null;
  orderId?: number | null;
  photographerId?: number | null;
  labId?: number | null;
  hasPrintItems?: boolean;
  hasOrganizer?: boolean;
  hasReferral?: boolean;
  /** Base fotógrafo (ARS) para estimar diff en líneas. */
  baseArsForEstimate?: number | null;
  /** Total cliente (ARS) para estimar diff en marketplace. */
  totalArsForEstimate?: number | null;
};

export function isCheckoutFeeShadowModeEnabled(): boolean {
  const raw = process.env.CHECKOUT_FEE_SHADOW_MODE;
  return raw === "1" || raw === "true" || raw === "TRUE";
}

function normalizePercent(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, Math.round(n));
}

export function estimateCheckoutFeeDiffArs(params: {
  legacyFeePercent: number;
  canonicalFeePercent: number;
  baseArsForEstimate?: number | null;
  totalArsForEstimate?: number | null;
}): number | null {
  const legacy = normalizePercent(params.legacyFeePercent);
  const canonical = normalizePercent(params.canonicalFeePercent);
  if (legacy === canonical) return 0;

  const base = params.baseArsForEstimate;
  if (base != null && Number.isFinite(base) && base > 0) {
    return feeFromBase(base, canonical) - feeFromBase(base, legacy);
  }

  const total = params.totalArsForEstimate;
  if (total != null && Number.isFinite(total) && total > 0) {
    return feeFromTotal(total, canonical) - feeFromTotal(total, legacy);
  }

  return null;
}

/** Construye payload de log; null si no hay divergencia. */
export function buildCheckoutFeeShadowLogPayload(
  input: CheckoutFeeShadowCompareInput & { canonicalFeePercent: number }
): CheckoutFeeShadowLogPayload | null {
  const legacyFeePercent = normalizePercent(input.legacyFeePercent);
  const canonicalFeePercent = normalizePercent(input.canonicalFeePercent);
  const diffPercent = canonicalFeePercent - legacyFeePercent;
  if (diffPercent === 0) return null;

  const { resolveInput } = input;
  return {
    site: input.site,
    flow: resolveInput.flow,
    component: resolveInput.component,
    purpose: resolveInput.purpose,
    legacyFeePercent,
    canonicalFeePercent,
    diffPercent,
    estimatedDiffArs: estimateCheckoutFeeDiffArs({
      legacyFeePercent,
      canonicalFeePercent,
      baseArsForEstimate: input.baseArsForEstimate,
      totalArsForEstimate: input.totalArsForEstimate,
    }),
    albumId: input.albumId ?? resolveInput.albumId ?? null,
    orderId: input.orderId ?? null,
    hasPrintItems: Boolean(input.hasPrintItems ?? resolveInput.hasPrintItems),
    hasOrganizer: Boolean(input.hasOrganizer),
    hasReferral: Boolean(input.hasReferral),
    labId: input.labId ?? resolveInput.labId ?? null,
    photographerId: input.photographerId ?? resolveInput.photographerId ?? null,
  };
}

export function logCheckoutFeeShadowDivergence(payload: CheckoutFeeShadowLogPayload): void {
  // JSON en la misma línea para `summarize:checkout-fee-shadow` y log drains.
  console.warn(`${CHECKOUT_FEE_SHADOW_LOG_TAG} ${JSON.stringify(payload)}`);
}

/** Registra divergencia si canonical ≠ legacy (usado por tests y run). */
export function emitCheckoutFeeShadowCompareIfDivergent(
  input: CheckoutFeeShadowCompareInput,
  canonicalFeePercent: number
): void {
  const payload = buildCheckoutFeeShadowLogPayload({
    ...input,
    canonicalFeePercent,
  });
  if (payload) {
    logCheckoutFeeShadowDivergence(payload);
  }
}

/**
 * Ejecuta comparación async. Nunca lanza al caller.
 */
export async function runCheckoutFeeShadowCompare(
  input: CheckoutFeeShadowCompareInput
): Promise<void> {
  if (!isCheckoutFeeShadowModeEnabled()) return;

  try {
    const { resolveCheckoutFeePercent } = await import(
      "@/lib/pricing/resolve-checkout-fee-percent"
    );
    const canonical = await resolveCheckoutFeePercent(input.resolveInput);
    emitCheckoutFeeShadowCompareIfDivergent(input, canonical.percent);
  } catch (err) {
    console.warn("[checkout-fee-shadow-error]", {
      site: input.site,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Fire-and-forget: no bloquea checkout ni altera resultados.
 * Si shadow mode está apagado, retorna de inmediato sin I/O extra.
 */
export function scheduleCheckoutFeeShadowCompare(input: CheckoutFeeShadowCompareInput): void {
  if (!isCheckoutFeeShadowModeEnabled()) return;
  void runCheckoutFeeShadowCompare(input);
}
