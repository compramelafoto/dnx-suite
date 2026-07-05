/**
 * Política pura (sin I/O) del resolver unificado de fee %.
 * Define qué implementación canónica usar por contexto y dónde diverge el legacy.
 */
import type {
  CheckoutFeeComponent,
  CheckoutFeeFlow,
  CheckoutFeePurpose,
  CheckoutFeeResolverImplementation,
  CheckoutOrderOrigin,
  LegacyFeeResolverId,
  ResolveCheckoutFeePercentInput,
} from "@/lib/pricing/checkout-fee-types";

export type CheckoutFeePolicyRoute = {
  implementation: CheckoutFeeResolverImplementation;
  legacyResolver: LegacyFeeResolverId;
  legacyDivergence?: {
    legacyResolver: LegacyFeeResolverId;
    codePath: string;
    note: string;
  };
};

function isPackOrPreventaFlow(flow: CheckoutFeeFlow, orderOrigin?: CheckoutOrderOrigin): boolean {
  return (
    flow === "PREVENTA_PACK" ||
    flow === "ALBUM_PACK" ||
    flow === "PACK_REDEMPTION" ||
    orderOrigin === "PREVENTA_PACK" ||
    orderOrigin === "PACK_REDEMPTION"
  );
}

function r1Digital(): CheckoutFeePolicyRoute {
  return { implementation: "ALBUM_ORDER_DIGITAL_MARKETPLACE", legacyResolver: "R1" };
}

function r2Print(): CheckoutFeePolicyRoute {
  return { implementation: "PRINT_ALBUM_PLATFORM", legacyResolver: "R2" };
}

function r3Legacy(): CheckoutFeePolicyRoute {
  return { implementation: "PLATFORM_LEGACY", legacyResolver: "R3" };
}

/** Política canónica unificada (target post-migración). */
export function resolveCheckoutFeePolicy(input: ResolveCheckoutFeePercentInput): CheckoutFeePolicyRoute {
  const { component, flow, purpose, hasPrintItems, orderOrigin } = input;

  if (isPackOrPreventaFlow(flow, orderOrigin)) {
    return r1Digital();
  }

  if (flow === "PRINT_PUBLIC") {
    return { implementation: "PRINT_PUBLIC_BPS", legacyResolver: "R3" };
  }

  if (flow === "PRINT_PHOTOGRAPHER") {
    return { implementation: "PRINT_PHOTOGRAPHER_BPS", legacyResolver: "R2" };
  }

  if (flow === "PRINT_LAB") {
    return r3Legacy();
  }

  if (flow === "ALBUM_ORDER") {
    return resolveAlbumOrderPolicy(component, purpose, Boolean(hasPrintItems));
  }

  return r3Legacy();
}

function resolveAlbumOrderPolicy(
  component: CheckoutFeeComponent,
  purpose: CheckoutFeePurpose,
  hasPrintItems: boolean
): CheckoutFeePolicyRoute {
  if (purpose === "CLIENT_LINE_UNIT") {
    if (component === "PRINT") {
      return r2Print();
    }
    // D1: digital en línea debe usar R1 (hoy pricing-engine usa R2 vía getPlatformFeePercent).
    return {
      ...r1Digital(),
      legacyDivergence: {
        legacyResolver: "R2",
        codePath: "lib/pricing/pricing-engine.ts (platformFeeMultiplier digital)",
        note: "D1 — motor aplica R2 en unitPrice digital; canónico R1.",
      },
    };
  }

  if (purpose === "DISPLAY") {
    return component === "PRINT" ? r2Print() : r1Digital();
  }

  // MARKETPLACE_FEE_TOTAL | ORGANIZER_BASE_EXTRACT | SNAPSHOT_PERSIST
  const canonical = r1Digital();
  if (hasPrintItems && (purpose === "ORGANIZER_BASE_EXTRACT" || purpose === "MARKETPLACE_FEE_TOTAL")) {
    return {
      ...canonical,
      legacyDivergence: {
        legacyResolver: "R3",
        codePath: "app/api/payments/mp/create-preference/route.ts (platformPercentAlbum mixto)",
        note: "D2 — MP mixto usa R3 para base organizador; canónico R1.",
      },
    };
  }

  if (component === "PRINT" && purpose === "SNAPSHOT_PERSIST") {
    return {
      ...canonical,
      legacyDivergence: {
        legacyResolver: "R2",
        codePath: "lib/pricing/pricing-engine.ts (snapshot.platformFeePercent)",
        note: "D3 — snapshot guarda R2 en platformFeePercent; marketplaceFeePercent ya es R1.",
      },
    };
  }

  return canonical;
}

/** Comportamiento legacy documentado por código path (solo comparación en tests). */
export function resolveLegacyProductionFeePolicy(
  input: ResolveCheckoutFeePercentInput
): CheckoutFeePolicyRoute {
  const { component, flow, purpose, hasPrintItems, orderOrigin } = input;

  if (isPackOrPreventaFlow(flow, orderOrigin)) {
    return r1Digital();
  }

  if (flow === "PRINT_PUBLIC") {
    return { implementation: "PRINT_PUBLIC_BPS", legacyResolver: "R3" };
  }

  if (flow === "PRINT_PHOTOGRAPHER") {
    return { implementation: "PRINT_PHOTOGRAPHER_BPS", legacyResolver: "R2" };
  }

  if (flow === "ALBUM_ORDER") {
    if (purpose === "CLIENT_LINE_UNIT") {
      if (component === "PRINT") return r2Print();
      // pricing-engine hoy: getPlatformFeePercent (R2) para digital lines
      return r2Print();
    }
    if (purpose === "DISPLAY" && component === "PRINT") {
      return r2Print();
    }
    if (
      hasPrintItems &&
      (purpose === "ORGANIZER_BASE_EXTRACT" || purpose === "MARKETPLACE_FEE_TOTAL")
    ) {
      return r3Legacy();
    }
    if (purpose === "SNAPSHOT_PERSIST" && component === "PRINT") {
      return r2Print();
    }
    return r1Digital();
  }

  return r3Legacy();
}
