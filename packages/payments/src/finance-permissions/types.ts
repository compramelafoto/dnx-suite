export type FinanceCapability =
  | "DNX_FINANCE_OWNER"
  | "DNX_FINANCE_ADMIN"
  | "PRODUCT_FINANCE_MANAGER"
  | "PRODUCT_FINANCE_VIEWER";

export type FinanceGrantStatus = "ACTIVE" | "REVOKED";

export interface FinanceGrant {
  id: string;
  userId: number;
  capability: FinanceCapability;
  productKey: string | null;
  scopeType: string | null;
  scopeId: string | null;
  status: FinanceGrantStatus;
  grantedByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type FinanceAction =
  | "manage_suite_finance"
  | "ops_finance"
  | "create_agreement"
  | "invite_participant"
  | "publish_distribution"
  | "view_agreement"
  | "accept_participation"
  | "assign_own_payment_account";

export interface FinanceActor {
  userId: number;
  /** Ownership of financial identities (PARTICIPANT_SELF). */
  ownedFinancialIdentityIds?: readonly string[];
  grants: readonly FinanceGrant[];
}
