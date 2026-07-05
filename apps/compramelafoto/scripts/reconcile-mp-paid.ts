/**
 * Reconciliación manual MP: PAID álbum, PAID_HELD precompra, entitlements.
 *
 * Órdenes PAID: solo filas con `Order.updatedAt` en la ventana de días (post-migración order_updatedAt).
 *
 * Uso:
 *   npx tsx scripts/reconcile-mp-paid.ts
 *   npx tsx scripts/reconcile-mp-paid.ts --dry-run
 *   npx tsx scripts/reconcile-mp-paid.ts --days=14
 */

import "dotenv/config";
import { reconcileMercadoPagoPaidAndPreCompra } from "../lib/reconcile-mp-paid-and-precompra";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const daysArg = args.find((a) => a.startsWith("--days="));
const days = daysArg ? parseInt(daysArg.split("=")[1] || "30", 10) : 30;

async function main() {
  const result = await reconcileMercadoPagoPaidAndPreCompra({
    daysBack: Number.isFinite(days) ? days : 30,
    dryRun,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
