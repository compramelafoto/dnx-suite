/**
 * Elegibilidad contextual de campañas welcome (edición / evento / concurso).
 * Usa participación opcional — sin migraciones.
 *
 * Global deliberado:
 * - participación con contextType GLOBAL | PLATFORM; o
 * - participación null SOLO si `treatNullParticipationAsGlobal` (compat Clickatón E3).
 *
 * Null participation con treatNull=false → NO se trata como global (evita huérfanas).
 */

import type { DnxPartnerApplication, DnxPartnerContextType } from "./types";

export type PartnerCampaignScopeContext = {
  application: DnxPartnerApplication | string;
  contextType: DnxPartnerContextType | string;
  contextId: string | null;
  status: string;
  archivedAt: Date | string | null;
  /** HIDDEN | PUBLIC — si falta, no se exige para GLOBAL/PLATFORM. */
  publicVisibility?: string | null;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
};

export type PartnerWelcomeScopeKind = "EDITION" | "EVENT" | "CONTEST";

const GLOBAL_CONTEXT_TYPES = new Set(["GLOBAL", "PLATFORM"]);

const SCOPE_CONTEXT_TYPES: Record<PartnerWelcomeScopeKind, ReadonlySet<string>> = {
  EDITION: new Set(["EDITION", "EVENT"]),
  EVENT: new Set(["EDITION", "EVENT"]),
  CONTEST: new Set(["CONTEST"]),
};

export type PartnerCampaignEditionContext = PartnerCampaignScopeContext;

function toTime(v: Date | string | null | undefined): number | null {
  if (v == null) return null;
  const t = typeof v === "string" ? Date.parse(v) : v.getTime();
  return Number.isFinite(t) ? t : null;
}

function isParticipationWithinDates(
  p: PartnerCampaignScopeContext,
  now: Date,
): boolean {
  const nowMs = now.getTime();
  const start = toTime(p.startsAt);
  const end = toTime(p.endsAt);
  if (start != null && start > nowMs) return false;
  if (end != null && end < nowMs) return false;
  return true;
}

/**
 * ¿Puede mostrarse la campaña en el scope indicado?
 */
export function isPartnerCampaignEligibleForScopeContext(input: {
  application: DnxPartnerApplication | string;
  scopeKind: PartnerWelcomeScopeKind;
  scopeId: string;
  participation: PartnerCampaignScopeContext | null | undefined;
  /**
   * Clickatón E3: `true` (null participation = global deliberado histórico).
   * FotoRank E4: `false` (solo GLOBAL/PLATFORM explícito o CONTEST match).
   */
  treatNullParticipationAsGlobal: boolean;
  /**
   * FotoRank: solo `ACTIVE` (DRAFT/PROPOSED/COMPLETED/etc. = no elegible).
   * Clickatón mantiene rechazo amplio CANCELLED/ARCHIVED.
   */
  requireActiveParticipationStatus?: boolean;
  now?: Date;
}): boolean {
  const scopeId = input.scopeId.trim();
  if (!scopeId) return false;

  const p = input.participation;
  const now = input.now ?? new Date();

  if (!p) {
    return input.treatNullParticipationAsGlobal === true;
  }

  if (p.application !== input.application) return false;
  if (p.archivedAt) return false;
  if (p.status === "CANCELLED" || p.status === "ARCHIVED") return false;
  if (input.requireActiveParticipationStatus === true && p.status !== "ACTIVE") {
    return false;
  }
  if (!isParticipationWithinDates(p, now)) return false;

  const ctx = String(p.contextType);
  if (GLOBAL_CONTEXT_TYPES.has(ctx)) return true;

  const allowed = SCOPE_CONTEXT_TYPES[input.scopeKind];
  if (allowed.has(ctx)) {
    if (p.publicVisibility === "HIDDEN") return false;
    return Boolean(p.contextId) && p.contextId === scopeId;
  }

  return false;
}

/**
 * Compat Etapa 3 Clickatón — null participation = global.
 */
export function isPartnerCampaignEligibleForEditionContext(input: {
  editionId: string;
  participation: PartnerCampaignScopeContext | null | undefined;
  now?: Date;
}): boolean {
  return isPartnerCampaignEligibleForScopeContext({
    application: "CLICKATON",
    scopeKind: "EDITION",
    scopeId: input.editionId,
    participation: input.participation,
    treatNullParticipationAsGlobal: true,
    now: input.now,
  });
}

/**
 * FotoRank concurso — null participation NO es global.
 */
export function isPartnerCampaignEligibleForContestContext(input: {
  contestId: string;
  participation: PartnerCampaignScopeContext | null | undefined;
  now?: Date;
}): boolean {
  return isPartnerCampaignEligibleForScopeContext({
    application: "FOTO_RANK",
    scopeKind: "CONTEST",
    scopeId: input.contestId,
    participation: input.participation,
    treatNullParticipationAsGlobal: false,
    requireActiveParticipationStatus: true,
    now: input.now,
  });
}
