"use client";

import type { BenefitRow } from "./types";
import {
  formatPackCompositionSummaryLine,
  summarizePackCompositionFromBenefits,
} from "@/lib/preventa-canjeable/pack-composition-summary";

export default function PreventaPackCompositionSummary({
  benefits,
  className = "",
}: {
  benefits?: BenefitRow[];
  className?: string;
}) {
  const summary = summarizePackCompositionFromBenefits(
    (benefits ?? []).map((b) => ({
      kind: b.kind,
      includedQuantity: b.includedQuantity,
      selectionMode: b.selectionMode,
      requiredPhotoCount: b.requiredPhotoCount,
      templatePolicy: b.templatePolicy,
      photographerProductId: b.photographerProductId,
    }))
  );

  if ((benefits?.length ?? 0) === 0) {
    return (
      <p className={`text-xs text-amber-700 m-0 ${className}`}>
        Sin productos incluidos — agregá al menos uno antes de publicar.
      </p>
    );
  }

  return (
    <p className={`text-xs text-[#6b7280] m-0 ${className}`}>
      {formatPackCompositionSummaryLine(summary)}
      {summary.requiresSelection ? " · Requiere selección de fotos" : ""}
    </p>
  );
}
