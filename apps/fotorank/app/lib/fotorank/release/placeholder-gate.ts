/**
 * Gate de apertura productiva: bases placeholder / reglas críticas vacías.
 */
import { contentContainsPlaceholder } from "../registration/rules-hash";

export type PlaceholderGateStatus =
  | "READY"
  | "BLOCKED_PLACEHOLDER"
  | "BLOCKED_NO_PUBLISHED_RULES"
  | "BLOCKED_DRAFT_ONLY"
  | "BLOCKED_CRITICAL_RULES_EMPTY";

export type PlaceholderGateReport = {
  status: PlaceholderGateStatus;
  hasPublishedRules: boolean;
  hasDraftRules: boolean;
  publishedContainsPlaceholder: boolean;
  registrantsOnOlderVersion: number;
  criticalPending: string[];
  adminChecklist: Array<{ item: string; done: boolean }>;
};

export function evaluatePlaceholderGate(input: {
  publishedContent: string | null;
  draftExists: boolean;
  registrantsOnOlderVersion?: number;
  confirmedRules?: {
    imageUsageTerms?: boolean;
    privacy?: boolean;
    minAge?: boolean;
    participationConditions?: boolean;
    technicalRules?: boolean;
    dates?: boolean;
    prizes?: boolean;
    disqualification?: boolean;
    publicationAuthorization?: boolean;
  };
}): PlaceholderGateReport {
  const hasPublished = Boolean(input.publishedContent?.trim());
  const placeholder = hasPublished && contentContainsPlaceholder(input.publishedContent!);
  const criticalPending: string[] = [];
  const c = input.confirmedRules ?? {};
  const checklist = [
    { item: "bases oficiales cargadas", done: hasPublished && !placeholder },
    { item: "versión revisada", done: Boolean(c.technicalRules) },
    { item: "publicada", done: hasPublished },
    { item: "hash generado", done: hasPublished },
    { item: "fecha de publicación", done: hasPublished },
    { item: "responsable", done: Boolean(c.participationConditions) },
    { item: "términos de uso de imagen", done: Boolean(c.imageUsageTerms) },
    { item: "privacidad", done: Boolean(c.privacy) },
    { item: "edad mínima", done: Boolean(c.minAge) },
    { item: "condiciones de participación", done: Boolean(c.participationConditions) },
    { item: "reglas técnicas", done: Boolean(c.technicalRules) },
    { item: "fechas", done: Boolean(c.dates) },
    { item: "premios", done: Boolean(c.prizes) },
    { item: "descalificación", done: Boolean(c.disqualification) },
    { item: "autorización de publicación", done: Boolean(c.publicationAuthorization) },
  ];
  for (const row of checklist) {
    if (!row.done) criticalPending.push(row.item);
  }

  let status: PlaceholderGateStatus = "READY";
  if (!hasPublished && input.draftExists) status = "BLOCKED_DRAFT_ONLY";
  else if (!hasPublished) status = "BLOCKED_NO_PUBLISHED_RULES";
  else if (placeholder) status = "BLOCKED_PLACEHOLDER";
  else if (criticalPending.length > 0) status = "BLOCKED_CRITICAL_RULES_EMPTY";

  return {
    status,
    hasPublishedRules: hasPublished,
    hasDraftRules: input.draftExists,
    publishedContainsPlaceholder: placeholder,
    registrantsOnOlderVersion: input.registrantsOnOlderVersion ?? 0,
    criticalPending,
    adminChecklist: checklist,
  };
}

export function assertProductionOpenAllowed(report: PlaceholderGateReport): void {
  if (report.status !== "READY") {
    throw new Error(`Apertura productiva bloqueada: ${report.status}`);
  }
}
