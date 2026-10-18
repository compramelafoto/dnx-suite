import { prisma } from "@/lib/prisma";

import { prismaSyncPorts } from "./prisma-ports";
import { syncAccount, type SyncResult } from "./sync";

/** Sincroniza todas las cuentas conectadas, en orden, dentro del tiempo disponible. */
export async function runMailSync(opts: { budgetMs: number }): Promise<SyncResult[]> {
  const deadlineMs = Date.now() + opts.budgetMs;
  const accounts = await prisma.expenseMailAccount.findMany({ orderBy: { id: "asc" } });
  if (accounts.length === 0) return [];
  const ports = prismaSyncPorts();
  const results: SyncResult[] = [];
  for (const a of accounts) {
    results.push(
      await syncAccount(
        {
          id: a.id,
          email: a.email,
          lastSyncAt: a.lastSyncAt,
          backfillDone: a.backfillDone,
          lastErrorAlertedAt: a.lastErrorAlertedAt,
        },
        ports,
        { now: new Date(), deadlineMs },
      ),
    );
  }
  return results;
}
