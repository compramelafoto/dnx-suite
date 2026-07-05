/**
 * Recupera un pedido de álbum FAILED/PENDING cuando MP tiene un pago approved.
 *
 * Uso:
 *   npx tsx scripts/recover-album-order-mp-payment.ts 1049
 *   npx tsx scripts/recover-album-order-mp-payment.ts 1049 161198302511
 */

import "dotenv/config";
import { recoverAlbumOrderFromMercadoPagoPayment } from "../lib/reconcile-mp-pending-album-orders";

async function main() {
  const orderId = parseInt(process.argv[2] || "", 10);
  const paymentId = process.argv[3]?.trim() || undefined;
  if (!Number.isFinite(orderId)) {
    console.error("Uso: npx tsx scripts/recover-album-order-mp-payment.ts <orderId> [mpPaymentId]");
    process.exit(1);
  }

  const result = await recoverAlbumOrderFromMercadoPagoPayment({ orderId, paymentId });
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
