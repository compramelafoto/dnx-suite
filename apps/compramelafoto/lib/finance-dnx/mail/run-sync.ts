import { prisma } from "@/lib/prisma";

import { processPendingMail, type ProcessSummary } from "./process-ports";
import { prismaSyncPorts } from "./prisma-ports";
import { syncAccount, type SyncResult } from "./sync";

/** Tiempo total para leer y cargar: las rutas tienen 300 s y se deja margen para responder. */
const TOTAL_MS = 270_000;

export type MailRunResult = { results: SyncResult[]; processed: ProcessSummary | null; busy: boolean };

/** El candado vence solo, por si una corrida muere sin liberarlo. */
const LOCK_MS = 6 * 60_000;

/** Toma el candado si está libre o vencido. Un UPDATE condicional es atómico aunque haya varias conexiones. */
async function acquireLock(): Promise<boolean> {
  const taken = await prisma.expenseMailRunLock.updateMany({
    where: { id: 1, OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }] },
    data: { lockedUntil: new Date(Date.now() + LOCK_MS) },
  });
  return taken.count === 1;
}

/**
 * Sincroniza las cuentas conectadas y convierte los mails en gastos. El candado evita que el
 * cron y "Leer ahora" corran a la vez (duplicarían gastos sin número de factura).
 */
export async function runMailSync(opts: { budgetMs: number }): Promise<MailRunResult> {
  const startedAt = Date.now();
  if (!(await acquireLock())) return { results: [], processed: null, busy: true };
  try {
    const results = await syncAllAccounts(opts.budgetMs);
    const processed = results.length ? await processPendingMail({ deadlineMs: startedAt + TOTAL_MS }) : null;
    return { results, processed, busy: false };
  } finally {
    await prisma.expenseMailRunLock.update({ where: { id: 1 }, data: { lockedUntil: null } }).catch(() => null);
  }
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
