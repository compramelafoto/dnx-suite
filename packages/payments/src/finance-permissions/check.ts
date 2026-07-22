import { FinancePermissionDeniedError } from "./errors.js";
import type { FinanceAction, FinanceActor, FinanceGrant } from "./types.js";

function activeGrants(actor: FinanceActor): FinanceGrant[] {
  return actor.grants.filter((g) => g.status === "ACTIVE");
}

function hasSuiteOwner(actor: FinanceActor): boolean {
  return activeGrants(actor).some((g) => g.capability === "DNX_FINANCE_OWNER");
}

function hasSuiteAdmin(actor: FinanceActor): boolean {
  return activeGrants(actor).some((g) => g.capability === "DNX_FINANCE_ADMIN");
}

function productGrant(
  actor: FinanceActor,
  capability: FinanceGrant["capability"],
  productKey: string,
  scopeType?: string | null,
  scopeId?: string | null,
): boolean {
  return activeGrants(actor).some((g) => {
    if (g.capability !== capability) return false;
    if (g.productKey !== productKey) return false;
    if (g.scopeType && scopeType && g.scopeType !== scopeType) return false;
    if (g.scopeId && scopeId && g.scopeId !== scopeId) return false;
    return true;
  });
}

export function canPerformFinanceAction(
  actor: FinanceActor,
  action: FinanceAction,
  context: {
    productKey?: string;
    scopeType?: string | null;
    scopeId?: string | null;
    financialIdentityId?: string;
  } = {},
): boolean {
  if (hasSuiteOwner(actor)) return true;

  switch (action) {
    case "manage_suite_finance":
      return false;
    case "ops_finance":
      return hasSuiteAdmin(actor);
    case "create_agreement":
    case "invite_participant":
    case "publish_distribution": {
      if (!context.productKey) return false;
      if (hasSuiteAdmin(actor)) return true;
      return productGrant(
        actor,
        "PRODUCT_FINANCE_MANAGER",
        context.productKey,
        context.scopeType,
        context.scopeId,
      );
    }
    case "view_agreement": {
      if (!context.productKey) return false;
      if (hasSuiteAdmin(actor)) return true;
      if (
        productGrant(
          actor,
          "PRODUCT_FINANCE_MANAGER",
          context.productKey,
          context.scopeType,
          context.scopeId,
        )
      ) {
        return true;
      }
      return productGrant(
        actor,
        "PRODUCT_FINANCE_VIEWER",
        context.productKey,
        context.scopeType,
        context.scopeId,
      );
    }
    case "accept_participation":
    case "assign_own_payment_account": {
      const id = context.financialIdentityId;
      if (!id) return false;
      return (actor.ownedFinancialIdentityIds ?? []).includes(id);
    }
    default:
      return false;
  }
}

export function assertFinanceAction(
  actor: FinanceActor,
  action: FinanceAction,
  context: Parameters<typeof canPerformFinanceAction>[2] = {},
): void {
  if (!canPerformFinanceAction(actor, action, context)) {
    throw new FinancePermissionDeniedError(action);
  }
}

/**
 * Clickatón admin allowlist / product admin is NOT sufficient for finance %.
 * Only explicit FinanceGrant (or suite owner/admin where applicable).
 */
export function isClickatonAdminWithoutFinanceGrant(
  isClickatonAdmin: boolean,
  actor: FinanceActor,
  productKey = "clickaton",
): boolean {
  if (!isClickatonAdmin) return false;
  return !canPerformFinanceAction(actor, "publish_distribution", { productKey });
}
