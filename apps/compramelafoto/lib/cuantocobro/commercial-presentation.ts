import type { CuantoCobroQuoteDisplayMode, CuantoCobroQuoteItemType } from "@/lib/cuantocobro/types";

export type CuantoCobroCommercialDisplayMode = "detailed" | "total-only" | "grouped";

export const CC_DEFAULT_COMMERCIAL_NOTE =
  "Presupuesto válido por 7 días. La fecha queda reservada únicamente con seña.";

export const CC_COMMERCIAL_DISPLAY_MODE_LABELS: Record<CuantoCobroCommercialDisplayMode, string> = {
  detailed: "Detallado por producto o servicio",
  "total-only": "Total único",
  grouped: "Agrupado por tipo",
};

export const CC_COMMERCIAL_GROUP_LABELS: Record<CuantoCobroQuoteItemType, string> = {
  "own-service": "Servicios fotográficos",
  "physical-product": "Productos físicos",
  outsourced: "Servicios tercerizados",
  expense: "Viáticos / gastos",
};

export const CC_TOTAL_ONLY_LINE_LABEL = "Servicio fotográfico según detalle acordado";

type LegacyDisplayRaw = {
  commercialDisplayMode?: CuantoCobroCommercialDisplayMode;
  displayMode?: CuantoCobroQuoteDisplayMode;
};

export function resolveCommercialDisplayMode(raw: LegacyDisplayRaw): CuantoCobroCommercialDisplayMode {
  if (
    raw.commercialDisplayMode === "detailed" ||
    raw.commercialDisplayMode === "total-only" ||
    raw.commercialDisplayMode === "grouped"
  ) {
    return raw.commercialDisplayMode;
  }
  if (raw.displayMode === "total-only") return "total-only";
  return "detailed";
}

type LegacyNoteRaw = {
  commercialNote?: string;
  clientNote?: string;
};

export function resolveCommercialNote(raw: LegacyNoteRaw): string {
  const commercial = raw.commercialNote?.trim();
  if (commercial) return commercial;
  const legacy = raw.clientNote?.trim();
  if (legacy) return legacy;
  return CC_DEFAULT_COMMERCIAL_NOTE;
}

export function getEffectiveCommercialNote(commercialNote: string): string {
  const trimmed = commercialNote.trim();
  return trimmed || CC_DEFAULT_COMMERCIAL_NOTE;
}

export type CommercialQuoteGroup = {
  id: CuantoCobroQuoteItemType;
  label: string;
  amount: number;
};

export function buildCommercialQuoteGroups(input: {
  clientManagementAmount: number;
  subtotalOwnService: number;
  subtotalPhysicalProduct: number;
  subtotalOutsourced: number;
  subtotalExpense: number;
}): CommercialQuoteGroup[] {
  const ownServiceTotal = input.subtotalOwnService + input.clientManagementAmount;

  return (
    [
      { id: "own-service" as const, label: CC_COMMERCIAL_GROUP_LABELS["own-service"], amount: ownServiceTotal },
      {
        id: "physical-product" as const,
        label: CC_COMMERCIAL_GROUP_LABELS["physical-product"],
        amount: input.subtotalPhysicalProduct,
      },
      { id: "outsourced" as const, label: CC_COMMERCIAL_GROUP_LABELS.outsourced, amount: input.subtotalOutsourced },
      { id: "expense" as const, label: CC_COMMERCIAL_GROUP_LABELS.expense, amount: input.subtotalExpense },
    ] as CommercialQuoteGroup[]
  ).filter((group) => group.amount > 0);
}
