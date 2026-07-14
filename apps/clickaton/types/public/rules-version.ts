/**
 * Versionado público de bases / reglamento.
 * No implementa firma ni aceptación; solo el contrato.
 */

export type PublicRulesVersionStatus =
  | "draft"
  | "published"
  | "superseded"
  | "archived";

export type PublicRulesVersion = {
  marathonId: string;
  version: string;
  publishedAt?: string;
  effectiveAt?: string;
  expiresAt?: string;
  status: PublicRulesVersionStatus;
  acceptanceRequired: boolean;
  /** Hash opcional del documento publicado (integridad). */
  contentHash?: string;
  documentUrl?: string;
  title?: string;
  summary?: string;
};
