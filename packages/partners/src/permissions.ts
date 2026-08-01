import {
  DNX_PARTNER_CAPABILITIES,
  PartnersDomainError,
  type DnxPartnerCapability,
  type PartnerActor,
} from "./types";

/** Bundle operativo para admin Clickatón / ops DNX (v1). */
export const OPS_ADMIN_CAPABILITIES: readonly DnxPartnerCapability[] =
  DNX_PARTNER_CAPABILITIES;

export function resolveActorCapabilities(
  actor: PartnerActor,
): ReadonlySet<DnxPartnerCapability> {
  if (actor.isOpsAdmin) {
    return new Set(OPS_ADMIN_CAPABILITIES);
  }
  return new Set(actor.capabilities ?? []);
}

export function hasPartnerCapability(
  actor: PartnerActor,
  capability: DnxPartnerCapability,
): boolean {
  return resolveActorCapabilities(actor).has(capability);
}

export function assertPartnerCapability(
  actor: PartnerActor,
  capability: DnxPartnerCapability,
): void {
  if (!hasPartnerCapability(actor, capability)) {
    throw new PartnersDomainError(
      "FORBIDDEN",
      `Falta permiso ${capability}.`,
    );
  }
}

/** Mapeo legible (docs / UI). */
export const PARTNER_CAPABILITY_LABELS: Record<DnxPartnerCapability, string> = {
  PARTNER_VIEW: "partners.view",
  PARTNER_CREATE: "partners.create",
  PARTNER_UPDATE: "partners.update",
  PARTNER_ARCHIVE: "partners.archive",
  PARTNER_PARTICIPATIONS_MANAGE: "partners.participations.manage",
  PARTNER_CONTRIBUTIONS_MANAGE: "partners.contributions.manage",
  PARTNER_BENEFITS_VIEW: "partners.benefits.view",
  PARTNER_BENEFITS_MANAGE: "partners.benefits.manage",
  PARTNER_BENEFITS_PUBLISH: "partners.benefits.publish",
  PARTNER_BENEFITS_GRANT: "partners.benefits.grant",
  PARTNER_PAYMENTS_VIEW: "partners.payments.view",
  PARTNER_PAYMENTS_MANAGE: "partners.payments.manage",
  PARTNER_CONTACT_SENSITIVE: "partners.contact.sensitive",
};
