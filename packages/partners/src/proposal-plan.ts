/**
 * Arma la lista de líneas de una propuesta comercial.
 *
 * Las líneas llevan `quantity`, `unitPriceMinor`, `currency` y `selection`
 * desde el primer día aunque esta etapa no use precios: es lo que permite que
 * el configurador de patrocinios los complete después sin migrar datos.
 */

import { PROPOSAL_PIECES } from "./proposal-pieces";
import type { DnxPartnerAdPlacementKey } from "./campaigns";
import type { PlateTreatment } from "./proposal-contrast";
import { listSellableSpaces, type SellerScope } from "./inventory";
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
  placementKey: DnxPartnerAdPlacementKey;
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
  /**
   * Quién arma la propuesta. Define qué espacios puede ofrecer: nadie vende un
   * lugar que no es suyo, y lo no montado queda afuera.
   */
  seller: SellerScope;
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
  const vendibles = new Set(
    listSellableSpaces(input.seller).map((space) => space.placementKey),
  );
  const lines = PROPOSAL_PIECES.filter(
    (p) => !excluded.has(p.id) && vendibles.has(p.placementKey),
  )
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
