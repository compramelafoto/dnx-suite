/**
 * Arma la lista de líneas de una propuesta comercial.
 *
 * Las líneas llevan `quantity`, `unitPriceMinor`, `currency` y `selection`
 * desde el primer día aunque esta etapa no use precios: es lo que permite que
 * el configurador de patrocinios los complete después sin migrar datos.
 */

import { PROPOSAL_PIECES } from "./proposal-pieces";
import type { PlateTreatment } from "./proposal-contrast";
import { PartnersDomainError } from "./types";

export type ProposalLineKind =
  | "DIGITAL_PLACEMENT"
  | "PHYSICAL"
  | "MERCHANDISING"
  | "MENTION";

export type ProposalLineSelection = "INCLUDED" | "OPTIONAL" | "EXCLUDED";

export type ProposalLine = {
  pieceId: string;
  kind: ProposalLineKind;
  placementKey: string;
  label: string;
  location: string;
  background: string;
  quantity: number;
  /** Nulo en esta etapa. Lo completa el presupuestador. */
  unitPriceMinor: number | null;
  currency: string | null;
  selection: ProposalLineSelection;
  sortOrder: number;
};

export type ProposalPlanInput = {
  brandName: string;
  industry?: string | null;
  plate: PlateTreatment;
  /** Piezas que no van en esta propuesta. */
  excludePieceIds?: readonly string[];
};

export type ProposalPlan = {
  brandName: string;
  industry: string | null;
  plate: PlateTreatment;
  lines: ProposalLine[];
};

export function buildProposalPlan(input: ProposalPlanInput): ProposalPlan {
  const brandName = input.brandName.trim();
  if (!brandName) {
    throw new PartnersDomainError(
      "VALIDATION",
      "Falta el nombre de la marca.",
    );
  }

  const excluded = new Set(input.excludePieceIds ?? []);
  const lines = PROPOSAL_PIECES.filter((p) => !excluded.has(p.id))
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p): ProposalLine => ({
      pieceId: p.id,
      kind: "DIGITAL_PLACEMENT",
      placementKey: p.placementKey,
      label: `${p.label} · ${p.platformLabel}`,
      location: p.location,
      background: p.background,
      quantity: 1,
      unitPriceMinor: null,
      currency: null,
      selection: "INCLUDED",
      sortOrder: p.sortOrder,
    }));

  return {
    brandName,
    industry: input.industry?.trim() || null,
    plate: input.plate,
    lines,
  };
}
