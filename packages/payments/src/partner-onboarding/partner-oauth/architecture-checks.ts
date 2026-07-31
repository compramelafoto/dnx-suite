/**
 * Static architecture guards for partner vs owner OAuth (10D.2.1).
 * Used by tests — fail closed on anti-patterns.
 */

import { CLICKATON_MP_OWNER_ORG_REF } from "../owner-oauth/config.js";
import {
  PARTNER_MP_EXTERNAL_REF,
  PARTNER_MP_ORIGIN_APP,
  PARTNER_OAUTH_PURPOSES,
  isPartnerOAuthPurpose,
} from "./config.js";

export type ArchitectureCheckResult = {
  ok: boolean;
  violations: string[];
};

export function assertPartnerAccountShape(account: {
  originApp: string | null;
  externalReference: string | null;
  capabilities: string[];
  financialIdentitySubjectType?: string;
  organizationRef?: string | null;
}): ArchitectureCheckResult {
  const violations: string[] = [];
  if (account.originApp !== PARTNER_MP_ORIGIN_APP) {
    violations.push("PARTNER_ORIGIN_APP_MISMATCH");
  }
  if (account.externalReference !== PARTNER_MP_EXTERNAL_REF) {
    violations.push("PARTNER_EXTERNAL_REF_MISMATCH");
  }
  if (account.capabilities.includes("COLLECTOR")) {
    violations.push("PARTNER_MUST_NOT_BE_COLLECTOR");
  }
  if (account.organizationRef === CLICKATON_MP_OWNER_ORG_REF) {
    violations.push("PARTNER_MUST_NOT_USE_OWNER_ORG_REF");
  }
  if (
    account.financialIdentitySubjectType &&
    account.financialIdentitySubjectType !== "PERSON"
  ) {
    violations.push("PARTNER_REQUIRES_PERSON_IDENTITY");
  }
  return { ok: violations.length === 0, violations };
}

export function assertOwnerPurposeNotUsedAsPartner(purpose: string): boolean {
  return !isPartnerOAuthPurpose(purpose);
}

export function partnerPurposes(): string[] {
  return Object.values(PARTNER_OAUTH_PURPOSES);
}

export function forbidAccountKeyedByEmail(emailLike: string | null | undefined): boolean {
  // Accounts must be keyed by User.id → FinancialIdentity, never raw email.
  if (!emailLike) return true;
  return !emailLike.includes("@");
}
