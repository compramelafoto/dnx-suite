import { prisma } from "@/lib/prisma";

import { processPendingMail, type ProcessSummary } from "./process-ports";
import { prismaSyncPorts } from "./prisma-ports";
import { syncAccount, type SyncResult } from "./sync";

/** Sincroniza todas las cuentas conectadas dentro del tiempo disponible y convierte los mails en gastos. */
export async function runMailSync(opts: { budgetMs: number }): Promise<{ results: SyncResult[]; processed: ProcessSummary | null }> {
  const results = await syncAllAccounts(opts.budgetMs);
  return { results, processed: results.length ? await processPendingMail() : null };
}

async function syncAllAccounts(budgetMs: number): Promise<SyncResult[]> {
  const deadlineMs = Date.now() + budgetMs;
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
