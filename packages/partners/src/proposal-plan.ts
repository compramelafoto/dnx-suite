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

/** Si un espacio tiene lugar en el período que se está vendiendo. */
export type ProposalSpaceAvailability = {
  available: boolean;
  /** Cuándo se libera, si no hay lugar. */
  nextFreeAt: Date | null;
};

/** Una pieza que el vendedor puede ofrecer pero que hoy no tiene lugar. */
export type ProposalUnavailableLine = {
  pieceId: string;
  placementKey: DnxPartnerAdPlacementKey;
  label: string;
  nextFreeAt: Date | null;
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
  /**
   * Disponibilidad por espacio, en el período que se vende. Ausente significa
   * que no se filtra por cupo: es el comportamiento de siempre.
   */
  availability?: Readonly<
    Partial<Record<DnxPartnerAdPlacementKey, ProposalSpaceAvailability>>
  >;
  /** Piezas que no van en esta propuesta. */
  excludePieceIds?: readonly string[];
};

export type ProposalPlan = {
  brandName: string;
  industry: string | null;
  plate: PlateTreatment;
  lines: ProposalLine[];
  /**
   * Piezas que el vendedor podía ofrecer y quedaron afuera por falta de lugar,
   * con la fecha en que se liberan. Es información de venta además de un dato
   * técnico: «se libera el 1 de marzo, ¿te lo reservo?».
   */
  unavailable: ProposalUnavailableLine[];
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
  const ofrecibles = PROPOSAL_PIECES.filter(
    (p) => !excluded.has(p.id) && vendibles.has(p.placementKey),
  );

  const sinLugar = input.availability
    ? ofrecibles.filter((p) => input.availability?.[p.placementKey]?.available === false)
    : [];
  const sinLugarIds = new Set(sinLugar.map((p) => p.id));

  const lines = ofrecibles
    .filter((p) => !sinLugarIds.has(p.id))
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
    unavailable: sinLugar
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => ({
        pieceId: p.id,
        placementKey: p.placementKey,
        label: `${p.label} · ${p.platformLabel}`,
        nextFreeAt: input.availability?.[p.placementKey]?.nextFreeAt ?? null,
      })),
  };
}
