/**
 * Matriz de roles × recursos (P0-08). Fuente para tests y docs.
 */
export type Role =
  | "visitor"
  | "participant"
  | "participant_other"
  | "organizer_own"
  | "organizer_other"
  | "jury_assigned"
  | "jury_unassigned"
  | "jury_revoked"
  | "admin"
  | "system";

export type Resource =
  | "contest_public"
  | "rules_public"
  | "registration_own"
  | "registration_other"
  | "entry_own"
  | "entry_other"
  | "asset_original"
  | "asset_thumbnail"
  | "asset_jury_preview"
  | "checklist_full"
  | "metadata_full"
  | "org_review"
  | "jury_panel"
  | "metrics_public"
  | "metrics_org";

export type Access = "allow" | "deny" | "partial";

export type MatrixCell = { access: Access; reason: string };

export const ROLE_ACCESS_MATRIX: Record<Role, Partial<Record<Resource, MatrixCell>>> = {
  visitor: {
    contest_public: { access: "allow", reason: "Landing pública" },
    rules_public: { access: "allow", reason: "Bases publicadas" },
    registration_own: { access: "deny", reason: "Requiere auth" },
    asset_original: { access: "deny", reason: "Privado" },
    asset_jury_preview: { access: "deny", reason: "Privado" },
    metrics_public: { access: "partial", reason: "Solo conteos públicos" },
    jury_panel: { access: "deny", reason: "Requiere jurado" },
  },
  participant: {
    registration_own: { access: "allow", reason: "Dueño" },
    entry_own: { access: "allow", reason: "Dueño" },
    asset_thumbnail: { access: "allow", reason: "Preview propio" },
    asset_original: { access: "partial", reason: "Dueño; no público" },
    asset_jury_preview: { access: "allow", reason: "Derivado propio" },
    registration_other: { access: "deny", reason: "Cross-user" },
    entry_other: { access: "deny", reason: "Cross-user" },
    org_review: { access: "deny", reason: "No organizador" },
    jury_panel: { access: "deny", reason: "No jurado" },
  },
  participant_other: {
    entry_other: { access: "deny", reason: "Cross-user" },
    asset_original: { access: "deny", reason: "Cross-user" },
    asset_jury_preview: { access: "deny", reason: "Cross-user" },
  },
  organizer_own: {
    metrics_org: { access: "allow", reason: "Org membership" },
    checklist_full: { access: "allow", reason: "Revisión" },
    metadata_full: { access: "partial", reason: "Sin secretos de sistema" },
    asset_original: { access: "allow", reason: "Org autorizado" },
    org_review: { access: "allow", reason: "Revisión manual" },
    jury_panel: { access: "deny", reason: "Rol distinto" },
  },
  organizer_other: {
    metrics_org: { access: "deny", reason: "Cross-org" },
    asset_original: { access: "deny", reason: "Cross-org" },
    org_review: { access: "deny", reason: "Cross-org" },
  },
  jury_assigned: {
    jury_panel: { access: "allow", reason: "Assignment ACCEPTED" },
    asset_jury_preview: { access: "allow", reason: "Solo categoría asignada + CONFIRMED" },
    asset_original: { access: "deny", reason: "Nunca original" },
    metadata_full: { access: "deny", reason: "Solo resumen filtrado" },
    checklist_full: { access: "partial", reason: "Allowlist checks" },
    registration_own: { access: "deny", reason: "Sin identidad" },
  },
  jury_unassigned: {
    jury_panel: { access: "deny", reason: "Sin assignment" },
    asset_jury_preview: { access: "deny", reason: "Sin assignment" },
    asset_original: { access: "deny", reason: "Nunca" },
  },
  jury_revoked: {
    jury_panel: { access: "deny", reason: "Invitación/cuenta revocada" },
    asset_jury_preview: { access: "deny", reason: "Revocado" },
  },
  admin: {
    metrics_org: { access: "allow", reason: "Admin plataforma" },
    org_review: { access: "allow", reason: "Admin" },
    asset_original: { access: "partial", reason: "Solo con membership/org scope" },
  },
  system: {
    asset_original: { access: "allow", reason: "Procesamiento interno" },
    entry_own: { access: "allow", reason: "Pipeline" },
  },
};

export function assertMatrixDeniesOriginalForJury(): void {
  if (ROLE_ACCESS_MATRIX.jury_assigned.asset_original?.access !== "deny") {
    throw new Error("Matriz inválida: jurado no puede acceder a ORIGINAL");
  }
}
