import type {
  BenefitSelectionMode,
  BenefitTemplatePolicy,
  PackBenefitKind,
} from "@/lib/prisma";

export type BenefitCompositionInput = {
  kind: PackBenefitKind;
  includedQuantity: number;
  selectionMode: BenefitSelectionMode;
  requiredPhotoCount: number;
  templatePolicy: BenefitTemplatePolicy;
  photographerProductId?: number | null;
};

export type PackCompositionSummary = {
  digitalPhotoCount: number;
  hasDesign: boolean;
  hasPrint: boolean;
  requiresSelection: boolean;
  chips: string[];
};

function estimatedPhotosPerBenefit(b: BenefitCompositionInput): number {
  const qty = Math.max(0, b.includedQuantity);
  if (qty === 0) return 0;
  if (b.selectionMode === "SINGLE_PHOTO") return qty;
  if (b.selectionMode === "MULTI_PHOTO_FIXED") {
    return qty * Math.max(1, b.requiredPhotoCount);
  }
  return qty * Math.max(1, b.requiredPhotoCount);
}

function isDesignBenefit(b: BenefitCompositionInput): boolean {
  return b.templatePolicy === "REQUIRED" || b.templatePolicy === "OPTIONAL";
}

function isPrintBenefit(b: BenefitCompositionInput): boolean {
  return b.kind === "PHYSICAL" && !isDesignBenefit(b);
}

/**
 * Resumen legible derivado de BenefitDefinition (sin lógica de negocio nueva).
 */
export function summarizePackCompositionFromBenefits(
  benefits: BenefitCompositionInput[]
): PackCompositionSummary {
  let digitalPhotoCount = 0;
  let hasDesign = false;
  let hasPrint = false;
  let requiresSelection = false;
  const chips: string[] = [];

  for (const b of benefits) {
    if (b.kind === "DIGITAL") {
      digitalPhotoCount += estimatedPhotosPerBenefit(b);
    }
    if (isDesignBenefit(b)) {
      hasDesign = true;
      const q = Math.max(1, b.includedQuantity);
      chips.push(`${q}× diseño${q > 1 ? "s" : ""}`);
    } else if (isPrintBenefit(b)) {
      hasPrint = true;
      const q = Math.max(1, b.includedQuantity);
      chips.push(`${q}× impresión${q > 1 ? "es" : ""}`);
    } else if (b.kind === "DIGITAL") {
      const q = Math.max(1, b.includedQuantity);
      if (b.selectionMode === "MULTI_PHOTO_FIXED") {
        chips.push(
          `${q}× digital (${Math.max(1, b.requiredPhotoCount)} fotos c/u)`
        );
      } else {
        chips.push(`${q}× digital`);
      }
    }

    if (b.includedQuantity > 0 && b.selectionMode !== "ALBUM_CHOICE") {
      requiresSelection = true;
    }
    if (b.selectionMode === "ALBUM_CHOICE" && b.includedQuantity > 0) {
      requiresSelection = true;
    }
  }

  if (digitalPhotoCount > 0 && !chips.some((c) => c.includes("digital"))) {
    chips.unshift(
      `${digitalPhotoCount} foto${digitalPhotoCount !== 1 ? "s" : ""} digital${digitalPhotoCount !== 1 ? "es" : ""}`
    );
  }

  return {
    digitalPhotoCount,
    hasDesign,
    hasPrint,
    requiresSelection: benefits.length > 0 ? requiresSelection : false,
    chips: chips.slice(0, 6),
  };
}

export function formatPackCompositionSummaryLine(summary: PackCompositionSummary): string {
  if (summary.chips.length === 0) {
    return "Sin productos incluidos";
  }
  return summary.chips.join(" · ");
}

export function formatPackCompositionDetailLines(
  summary: PackCompositionSummary,
  opts?: { isSchoolAlbum?: boolean }
): string[] {
  const lines: string[] = [];
  if (summary.digitalPhotoCount > 0) {
    lines.push(
      `${summary.digitalPhotoCount} foto${summary.digitalPhotoCount !== 1 ? "s" : ""} digital${summary.digitalPhotoCount !== 1 ? "es" : ""} incluida${summary.digitalPhotoCount !== 1 ? "s" : ""}`
    );
  }
  if (summary.hasDesign) {
    lines.push("Incluye diseño personalizado");
  }
  if (summary.hasPrint) {
    lines.push("Incluye impresiones");
  }
  if (summary.requiresSelection) {
    lines.push("Requiere elegir fotos al canjear");
  }
  if (opts?.isSchoolAlbum) {
    lines.push("Campaña escolar: puede requerir selfie para identificación");
  }
  return lines;
}
