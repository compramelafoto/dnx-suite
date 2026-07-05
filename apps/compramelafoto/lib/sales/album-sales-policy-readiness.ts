import type { DiagnosticItem, DiagnosticSeverity } from "@/lib/album-diagnostics-types";
import type { AlbumSalesReadinessAlbum } from "@/lib/albums/album-sales-capability-readiness";
import type { AlbumSalesPolicy } from "@/lib/sales/album-sales-policy-types";

export type SalesPolicyReadinessSummary = {
  divergenceWarnings: string[];
  capabilityDigitalActive: boolean;
  legacyDigitalActive: boolean;
  capabilityPrintActive: boolean;
  legacyPrintActive: boolean;
  effectiveLabId: number | null;
  effectiveDigitalPriceArs: number | null;
  legacyCompletenessMatchesPolicy: boolean;
};

/** Contexto de evento colaborativo para readiness UI (tab Ventas / Fotos). */
export function eventCollaborativePricingFromPolicy(
  policy: AlbumSalesPolicy
): AlbumSalesReadinessAlbum["eventCollaborativePhotoPricing"] {
  if (!policy.digital.organizerLocksPricing && !policy.eventId) {
    return null;
  }
  const fixed = policy.digital.eventResolution?.appliedRule === "ORGANIZER_FIXED"
    ? policy.digital.effectiveBasePriceArs
    : policy.digital.eventResolution?.basePrice ?? null;
  return {
    locksPhotographerDigitalPricing: policy.digital.organizerLocksPricing,
    fixedPhotoPrice: fixed,
  };
}

export function buildSalesPolicyReadinessSummary(
  policy: AlbumSalesPolicy
): SalesPolicyReadinessSummary {
  return {
    divergenceWarnings: policy.divergence.summaryLines,
    capabilityDigitalActive: policy.capabilities.digitalSales,
    legacyDigitalActive: policy.digital.legacyEnabled,
    capabilityPrintActive: policy.capabilities.printSales,
    legacyPrintActive: policy.print.legacyEnabled,
    effectiveLabId: policy.lab.effectiveLabId,
    effectiveDigitalPriceArs: policy.digital.effectiveBasePriceArs,
    legacyCompletenessMatchesPolicy: policy.completeness.legacyIsComplete,
  };
}

export function buildSalesPolicyDiagnosticItems(
  policy: AlbumSalesPolicy
): DiagnosticItem[] {
  const items: DiagnosticItem[] = [];

  items.push({
    id: "policy_capabilities",
    severity: "info",
    title: `Capabilities efectivas: ${policy.capabilities.effective.join(", ") || "ninguna"}`,
    detail: policy.capabilities.inheritFromPhotographer
      ? "Herencia global del fotógrafo"
      : `Override álbum (permitidas: ${policy.capabilities.allowed.join(", ") || "—"})`,
  });

  items.push({
    id: "policy_digital_price",
    severity: policy.digital.effectiveBasePriceArs != null ? "ok" : "warning",
    title:
      policy.digital.effectiveBasePriceArs != null
        ? `Precio digital efectivo (resolver): ${policy.digital.effectiveBasePriceArs} ARS (${policy.digital.effectiveBasePriceSource})`
        : "Sin precio digital efectivo resoluble",
    detail:
      policy.digital.legacyBasePriceArs != null
        ? `Legacy base: ${policy.digital.legacyBasePriceArs} ARS (${policy.digital.legacyBasePriceSource})`
        : undefined,
  });

  items.push({
    id: "policy_lab",
    severity: policy.lab.effectiveLabId != null ? "ok" : "info",
    title: policy.lab.effectiveLabId
      ? `Lab efectivo #${policy.lab.effectiveLabId} (${policy.lab.effectiveLabSource})`
      : "Sin laboratorio efectivo (selectedLabId ni preferredLabId)",
    detail: policy.lab.selectedLabId
      ? `selectedLabId=${policy.lab.selectedLabId}`
      : policy.lab.preferredLabId
        ? `preferredLabId=${policy.lab.preferredLabId}`
        : undefined,
  });

  items.push({
    id: "policy_margin",
    severity: policy.print.hasMarginConfigured ? "ok" : "warning",
    title: `Margen impresión efectivo: ${policy.print.marginPercent}% (${policy.print.marginSource})`,
    detail: `printPricingSource=${policy.print.pricingSource}`,
  });

  items.push({
    id: "policy_fees",
    severity: "info",
    title: `Fees: digital ${policy.fees.digitalMarketplacePercent}% · impresión ${policy.fees.printPlatformPercent}%`,
    detail: "Fase 1 — solo análisis; checkout aún usa rutas legacy.",
  });

  if (policy.faceBulk.enabled) {
    items.push({
      id: "policy_face_bulk",
      severity: policy.faceBulk.basePriceArs != null ? "ok" : "warning",
      title:
        policy.faceBulk.basePriceArs != null
          ? `Face bulk: ${policy.faceBulk.basePriceArs} ARS base`
          : "Face bulk habilitado sin precio",
    });
  }

  if (policy.divergence.digitalLegacyVsCapability) {
    items.push({
      id: "policy_divergence_digital",
      severity: "warning",
      title: "Divergencia legacy vs capabilities (digital)",
      detail:
        policy.divergence.summaryLines.find((l) => l.startsWith("Digital:")) ??
        "enableDigitalPhotos ≠ DIGITAL_SALES",
    });
  }
  if (policy.divergence.printLegacyVsCapability) {
    items.push({
      id: "policy_divergence_print",
      severity: "warning",
      title: "Divergencia legacy vs capabilities (impresión)",
      detail:
        policy.divergence.summaryLines.find((l) => l.startsWith("Impresión:")) ??
        "enablePrintedPhotos ≠ PRINT_SALES",
    });
  }
  if (!policy.divergence.hasAny) {
    items.push({
      id: "policy_divergence_ok",
      severity: "ok",
      title: "Legacy y capabilities alineados (digital e impresión)",
    });
  }

  items.push({
    id: "policy_completeness",
    severity: policy.completeness.legacyIsComplete ? "ok" : "error",
    title: policy.completeness.legacyIsComplete
      ? "Resolver: completitud legacy OK (isAlbumComplete)"
      : "Resolver: completitud legacy incompleta",
    detail: policy.completeness.blockingReasons.join(" · ") || undefined,
  });

  return items;
}

export function salesPolicyReadinessSeverity(
  policy: AlbumSalesPolicy
): DiagnosticSeverity {
  if (policy.divergence.hasAny) return "warning";
  if (!policy.completeness.legacyIsComplete) return "error";
  return "ok";
}
