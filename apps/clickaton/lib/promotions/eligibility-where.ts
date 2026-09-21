import type { Prisma } from "@repo/db";
import type { PromotionEligibilityRule } from "@repo/promotions";

export type EligibilityIdentity = {
  email: string | null;
  userId: number | null;
};

/**
 * Arma el filtro que responde: ¿esta persona participó de alguna de estas ediciones?
 *
 * Devuelve null cuando no hay ningún dato con el cual identificarla; el llamador
 * lo traduce a "no elegible" sin consultar la base.
 */
export function buildEligibilityWhere(
  rule: PromotionEligibilityRule,
  identity: EligibilityIdentity,
): Prisma.ClickatonRegistrationWhereInput | null {
  const or: Prisma.ClickatonRegistrationWhereInput[] = [];

  const email = identity.email?.trim().toLowerCase();
  if (email) or.push({ email });
  if (identity.userId != null) or.push({ userId: identity.userId });
  if (or.length === 0) return null;

  return {
    editionId: { in: rule.editionIds },
    status: "CONFIRMED",
    isOpsTest: false,
    OR: or,
    ...(rule.requireCheckIn ? { checkIns: { some: {} } } : {}),
  };
}
