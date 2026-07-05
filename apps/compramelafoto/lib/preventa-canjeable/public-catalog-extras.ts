import type { PackBenefitKind } from "@/lib/prisma";
import { clientTotalFromPhotographerBaseArs } from "@/lib/pricing/client-price";

type BenefitExtraRow = {
  kind: PackBenefitKind;
  extraUnitPriceOverrideArs: number | null;
};

type PackWithBenefitExtras = { benefits: BenefitExtraRow[] };

/** Precio al cliente por unidad extra (misma base + fee que el pack), mínimo por tipo. */
export function aggregateExtraUnitClientMins(
  packs: PackWithBenefitExtras[],
  platformFeePercent: number
): { digitalMin: number | null; printMin: number | null } {
  let digitalMin: number | null = null;
  let printMin: number | null = null;
  for (const p of packs) {
    for (const b of p.benefits) {
      const raw = b.extraUnitPriceOverrideArs;
      if (raw == null || raw <= 0) continue;
      const client = clientTotalFromPhotographerBaseArs(raw, platformFeePercent);
      if (b.kind === "DIGITAL") {
        digitalMin = digitalMin == null ? client : Math.min(digitalMin, client);
      } else {
        printMin = printMin == null ? client : Math.min(printMin, client);
      }
    }
  }
  return { digitalMin, printMin };
}
