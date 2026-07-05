/**
 * Reconcilia pedidos de álbum PENDING y FAILED con pagos approved en Mercado Pago.
 *
 * Uso:
 *   npx tsx scripts/reconcile-pending-mp-album-orders.ts --days=30
 *   npx tsx scripts/reconcile-pending-mp-album-orders.ts --days=30 --dry-run
 *
 * Recuperar un pedido puntual:
 *   npx tsx scripts/recover-album-order-mp-payment.ts 1049 [mpPaymentId]
 *
 * Requiere .env con DATABASE_URL y MP_ACCESS_TOKEN (y tokens OAuth de fotógrafos en BD).
 */

import "dotenv/config";
import { reconcilePendingAlbumOrdersMercadoPago } from "../lib/reconcile-mp-pending-album-orders";

function arg(name: string, def?: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  if (process.argv.includes(`--${name}`) && def !== undefined) return def;
  return def;
}

async function main() {
  const daysRaw = arg("days", "30");
  const maxRaw = arg("maxOrders", "500");
  const dryRun = process.argv.includes("--dry-run") || arg("dry-run") === "1";

  const daysBack = Math.min(365, Math.max(1, parseInt(String(daysRaw), 10) || 30));
  const maxOrders = Math.min(2000, Math.max(1, parseInt(String(maxRaw), 10) || 500));

  console.log({ daysBack, maxOrders, dryRun });

  const result = await reconcilePendingAlbumOrdersMercadoPago({
    daysBack,
    maxOrders,
    dryRun,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
