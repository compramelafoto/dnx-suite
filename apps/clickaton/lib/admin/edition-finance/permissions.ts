import {
  canPerformFinanceAction,
  type FinanceActor,
  type FinanceGrant,
} from "@repo/payments/finance-permissions";
import { CLICKATON_PRODUCT_KEY, EDITION_SCOPE_TYPE } from "./constants";
import { EditionFinanceError } from "./domain/errors";

/**
 * Capacidad de producto: gestionar distribución financiera por edición.
 * Implementada vía DnxFinanceGrant (PRODUCT_FINANCE_MANAGER / DNX_FINANCE_OWNER).
 * No usar emails hardcodeados en actions.
 */
export function canManageEditionFinancialDistribution(
  actor: FinanceActor,
  editionId?: string,
): boolean {
  return canPerformFinanceAction(actor, "publish_distribution", {
    productKey: CLICKATON_PRODUCT_KEY,
    scopeType: EDITION_SCOPE_TYPE,
    scopeId: editionId,
  });
}

export function canViewEditionFinancialDistribution(
  actor: FinanceActor,
  editionId?: string,
): boolean {
  return canPerformFinanceAction(actor, "view_agreement", {
    productKey: CLICKATON_PRODUCT_KEY,
    scopeType: EDITION_SCOPE_TYPE,
    scopeId: editionId,
  });
}

export function assertCanManageEditionFinancialDistribution(
  actor: FinanceActor,
  editionId?: string,
): void {
  if (!canManageEditionFinancialDistribution(actor, editionId)) {
    throw new EditionFinanceError(
      "FORBIDDEN",
      "No tenés permiso para modificar la distribución financiera de la edición.",
    );
  }
}

export function assertCanViewEditionFinancialDistribution(
  actor: FinanceActor,
  editionId?: string,
): void {
  if (!canViewEditionFinancialDistribution(actor, editionId)) {
    throw new EditionFinanceError(
      "FORBIDDEN",
      "No tenés permiso para ver la distribución financiera de la edición.",
    );
  }
}

export function toFinanceActor(input: {
  userId: number;
  grants: FinanceGrant[];
  ownedFinancialIdentityIds?: string[];
}): FinanceActor {
  return {
    userId: input.userId,
    grants: input.grants,
    ownedFinancialIdentityIds: input.ownedFinancialIdentityIds,
  };
}

export type { FinanceActor, FinanceGrant };
