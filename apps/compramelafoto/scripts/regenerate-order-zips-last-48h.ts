/**
 * Regenera ZIPs y reenvía emails de descarga para pedidos de las últimas 48 horas
 * que compraron con "digital incluido con impresión" u otros ítems digitales.
 *
 * 1. Corrige OrderItems DIGITAL faltantes (caso "incluido con impresión")
 * 2. Crea ZipGenerationJobs (regenera aunque ya tengan uno COMPLETED)
 * 3. Procesa los jobs (genera ZIP, sube a R2, envía email)
 *
 * Uso: npx tsx scripts/regenerate-order-zips-last-48h.ts
 *
 * Alternativa: llamar al endpoint en producción (donde R2 está configurado):
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://tu-dominio.com/api/cron/regenerate-zips-last-48h"
 */

import { regenerateOrderZipsLastNHours } from "../lib/regenerate-order-zips";

const HOURS = 48;

async function main() {
  console.log(`\n=== Regenerando ZIPs de pedidos últimos ${HOURS}h ===\n`);

  const result = await regenerateOrderZipsLastNHours(HOURS, true);

  console.log(`\n--- Resumen ---`);
  console.log(`OrderItems corregidos: ${result.fixedItems}`);
  console.log(`Jobs FAILED reseteados a PENDING: ${result.jobsReset}`);
  console.log(`Jobs ZIP creados: ${result.jobsCreated}`);
  console.log(`Procesados: ${result.processed}`);
  if (result.failed > 0) {
    console.log(`Fallidos: ${result.failed}`);
    if (result.failedOrderIds.length > 0) {
      console.log(`Pedidos con error: #${result.failedOrderIds.join(", #")}`);
    }
  }
  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
