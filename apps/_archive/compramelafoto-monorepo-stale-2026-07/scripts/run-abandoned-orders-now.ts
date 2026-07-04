/**
 * Ejecuta processAbandonedOrders y processEmailQueue para enviar recordatorios
 * a pedidos realmente abandonados (PENDING > 1h, no supersedidos).
 *
 * Uso: npx tsx scripts/run-abandoned-orders-now.ts
 */

import { processAbandonedOrders } from "@/lib/jobs/abandonedOrders";
import { processEmailQueue } from "@/lib/email-sender";

async function main() {
  console.log("--- Procesando pedidos abandonados ---\n");

  const result = await processAbandonedOrders();
  console.log("Abandoned orders:", result);
  console.log("");

  if (result.sent > 0) {
    console.log("--- Enviando emails encolados ---\n");
    const emailResults = await processEmailQueue(20);
    console.log(`Emails procesados: ${emailResults.length}`);
    emailResults.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.status}${r.error ? ` - ${r.error}` : ""}`);
    });
  } else {
    console.log("No hay pedidos abandonados para notificar.");
  }

  console.log("\n--- Listo ---");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
