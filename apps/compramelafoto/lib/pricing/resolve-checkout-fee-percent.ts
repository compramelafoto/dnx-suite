/**
 * Fuente de verdad unificada para el % de fee en checkout (Fase 1.5).
 *
 * NO conectado aún a checkout, orders, pricing-engine ni Mercado Pago.
 * Delega en los resolvers existentes (R1/R2/R3) según política canónica.
 *
 * R1 → resolveAlbumOrderDigitalMarketplaceFeePercent
 * R2 → getPrintAlbumPlatformFeePercent
 * R3 → resolvePlatformCommissionPercent
 */
import { resolveAlbumOrderDigitalMarketplaceFeePercent } from "@/lib/pricing/album-order-digital-fee";
import { getPrintAlbumPlatformFeePercent } from "@/lib/pricing/print-pricing";
import { getAppConfig } from "@/lib/services/settingsService";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";
import {
  resolveCheckoutFeePolicy,
  resolveLegacyProductionFeePolicy,
  type CheckoutFeePolicyRoute,
} from "@/lib/pricing/checkout-fee-policy";
import type {
  CheckoutFeePercentResult,
  CheckoutFeeResolverImplementation,
  ResolveCheckoutFeePercentInput,
} from "@/lib/pricing/checkout-fee-types";

export type {
  CheckoutFeeComponent,
  CheckoutFeeFlow,
  CheckoutFeePurpose,
  CheckoutOrderOrigin,
  ResolveCheckoutFeePercentInput,
  CheckoutFeePercentResult,
} from "@/lib/pricing/checkout-fee-types";

export {
  CHECKOUT_FEE_FINANCIAL_BASE_ARS,
} from "@/lib/pricing/checkout-fee-types";

export {
  resolveCheckoutFeePolicy,
  resolveLegacyProductionFeePolicy,
} from "@/lib/pricing/checkout-fee-policy";

async function invokeFeeImplementation(
  implementation: CheckoutFeeResolverImplementation,
  input: ResolveCheckoutFeePercentInput
): Promise<number> {
  const photographerId = input.photographerId ?? null;
  const labId = input.labId ?? null;

  switch (implementation) {
    case "ALBUM_ORDER_DIGITAL_MARKETPLACE":
      return resolveAlbumOrderDigitalMarketplaceFeePercent({ photographerId, labId });
    case "PRINT_ALBUM_PLATFORM":
      return getPrintAlbumPlatformFeePercent();
    case "PLATFORM_LEGACY":
      return resolvePlatformCommissionPercent({ photographerId, labId });
    case "PRINT_PHOTOGRAPHER_BPS": {
      const config = await getAppConfig();
      const bps = config?.commissionPro_Bps;
      if (typeof bps === "number" && Number.isFinite(bps)) {
        return Math.round(bps) / 100;
      }
      return getPrintAlbumPlatformFeePercent();
    }
    case "PRINT_PUBLIC_BPS": {
      const config = await getAppConfig();
      const bps =
        input.labType === "TYPE_A"
          ? config?.commissionPublicTypeA_Bps
          : config?.commissionPublicTypeB_Bps;
      if (typeof bps === "number" && Number.isFinite(bps)) {
        return Math.round(bps) / 100;
      }
      return resolvePlatformCommissionPercent({ photographerId, labId });
    }
    default:
      return resolvePlatformCommissionPercent({ photographerId, labId });
  }
}

function normalizePercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(100, Math.round(value));
}

function toResult(
  percent: number,
  route: CheckoutFeePolicyRoute
): CheckoutFeePercentResult {
  return {
    percent: normalizePercent(percent),
    implementation: route.implementation,
    legacyResolver: route.legacyResolver,
    legacyDivergence: route.legacyDivergence,
  };
}

/**
 * Resuelve el % canónico para el contexto dado.
 * Wrapper futuro: `resolveClientMarketplaceFeePercent`, `getPlatformFeePercent`, etc.
 */
export async function resolveCheckoutFeePercent(
  input: ResolveCheckoutFeePercentInput
): Promise<CheckoutFeePercentResult> {
  const route = resolveCheckoutFeePolicy(input);
  const percent = await invokeFeeImplementation(route.implementation, input);
  return toResult(percent, route);
}

/**
 * % que usa hoy el código legacy en producción para el mismo contexto.
 * Solo para tests de migración y QA — no usar en checkout nuevo.
 */
export async function resolveLegacyCheckoutFeePercent(
  input: ResolveCheckoutFeePercentInput
): Promise<CheckoutFeePercentResult> {
  const route = resolveLegacyProductionFeePolicy(input);
  const percent = await invokeFeeImplementation(route.implementation, input);
  return toResult(percent, route);
}

/**
 * Variante síncrona cuando los % ya están resueltos (tests puros sin DB).
 */
type InjectedFeePercents = {
  r1DigitalPercent: number;
  r2PrintPercent: number;
  r3LegacyPercent: number;
  printPublicTypeAPercent?: number;
  printPublicTypeBPercent?: number;
  printPhotographerPercent?: number;
};

function percentFromRoute(
  route: CheckoutFeePolicyRoute,
  input: ResolveCheckoutFeePercentInput,
  injected: InjectedFeePercents
): number {
  switch (route.implementation) {
    case "ALBUM_ORDER_DIGITAL_MARKETPLACE":
      return injected.r1DigitalPercent;
    case "PRINT_ALBUM_PLATFORM":
      return injected.r2PrintPercent;
    case "PRINT_PHOTOGRAPHER_BPS":
      return injected.printPhotographerPercent ?? injected.r2PrintPercent;
    case "PRINT_PUBLIC_BPS":
      return input.labType === "TYPE_A"
        ? (injected.printPublicTypeAPercent ?? injected.r3LegacyPercent)
        : (injected.printPublicTypeBPercent ?? injected.r3LegacyPercent);
    default:
      return injected.r3LegacyPercent;
  }
}

export function resolveCheckoutFeePercentFromInjected(
  input: ResolveCheckoutFeePercentInput,
  injected: InjectedFeePercents
): CheckoutFeePercentResult {
  const route = resolveCheckoutFeePolicy(input);
  const percent = percentFromRoute(route, input, injected);
  return toResult(percent, route);
}

/** Variante síncrona del comportamiento legacy en producción (tests sin DB). */
export function resolveLegacyCheckoutFeePercentFromInjected(
  input: ResolveCheckoutFeePercentInput,
  injected: InjectedFeePercents
): CheckoutFeePercentResult {
  const route = resolveLegacyProductionFeePolicy(input);
  const percent = percentFromRoute(route, input, injected);
  return toResult(percent, route);
}
