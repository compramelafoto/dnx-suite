import { prisma } from "@/lib/admin/db";
import type { FinanceActor, FinanceGrant } from "../permissions";

export async function loadFinanceActor(userId: number): Promise<FinanceActor> {
  const [grants, identities] = await Promise.all([
    prisma.dnxFinanceGrant.findMany({
      where: { userId, status: "ACTIVE" },
    }),
    prisma.dnxFinancialIdentity.findMany({
      where: { ownerUserId: userId, status: "ACTIVE" },
      select: { id: true },
    }),
  ]);

  return {
    userId,
    ownedFinancialIdentityIds: identities.map((i) => i.id),
    grants: grants.map(
      (g): FinanceGrant => ({
        id: g.id,
        userId: g.userId,
        capability: g.capability,
        productKey: g.productKey,
        scopeType: g.scopeType,
        scopeId: g.scopeId,
        status: g.status,
        grantedByUserId: g.grantedByUserId,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      }),
    ),
  };
}
