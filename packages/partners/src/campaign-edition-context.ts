/**
 * Elegibilidad contextual de campañas welcome por edición Clickatón.
 * Usa participación opcional (sin campos nuevos / sin migraciones).
 */

import type { DnxPartnerApplication, DnxPartnerContextType } from "./types";

export type PartnerCampaignEditionContext = {
  application: DnxPartnerApplication | string;
  contextType: DnxPartnerContextType | string;
  contextId: string | null;
  status: string;
  archivedAt: Date | string | null;
};

const GLOBAL_CONTEXT_TYPES = new Set(["GLOBAL", "PLATFORM"]);
const EDITION_CONTEXT_TYPES = new Set(["EDITION", "EVENT"]);

/**
 * ¿Puede mostrarse esta campaña en la landing de la edición `editionId`?
 *
 * - Sin participación → campaña global → sí (cualquier edición pública).
 * - Participación GLOBAL/PLATFORM → sí.
 * - Participación EDITION/EVENT → solo si contextId === editionId.
 * - Otra edición / otro context → no (sin fallback).
 */
export function isPartnerCampaignEligibleForEditionContext(input: {
  editionId: string;
  participation: PartnerCampaignEditionContext | null | undefined;
}): boolean {
  const editionId = input.editionId.trim();
  if (!editionId) return false;

  const p = input.participation;
  if (!p) return true;

  if (p.application !== "CLICKATON") return false;
  if (p.archivedAt) return false;
  if (p.status === "CANCELLED" || p.status === "ARCHIVED") return false;

  const ctx = String(p.contextType);
  if (GLOBAL_CONTEXT_TYPES.has(ctx)) return true;

  if (EDITION_CONTEXT_TYPES.has(ctx)) {
    return Boolean(p.contextId) && p.contextId === editionId;
  }

  return false;
}
