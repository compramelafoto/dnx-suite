/**
 * Reenvía emails de descarga digital a clientes de pedidos PAID
 * de las últimas 48 horas que tienen ítems digitales.
 *
 * Uso: npx tsx scripts/resend-digital-emails-last-48h.ts
 *
 * O llamar al endpoint en producción:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://tu-dominio.com/api/cron/resend-digital-emails-last-48h"
 */

import { resendDigitalDownloadEmailsLastNHours } from "../lib/resend-digital-emails";

const HOURS = 48;

async function main() {
  console.log(`\n=== Reenviando emails de descarga (últimas ${HOURS}h) ===\n`);

  const result = await resendDigitalDownloadEmailsLastNHours(HOURS);

  console.log(`Pedidos con digital: ${result.total}`);
  console.log(`Emails encolados: ${result.queued}`);
  console.log(`Omitidos (ya en cola): ${result.skipped}`);
  if (result.errors.length > 0) {
    console.log(`Errores: ${result.errors.length}`);
    result.errors.forEach((e) => console.log(`  #${e.orderId}: ${e.error}`));
  }
  console.log("\nEl cron process-email-queue enviará los emails en los próximos minutos.\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
