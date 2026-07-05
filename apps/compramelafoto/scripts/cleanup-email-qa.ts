/**
 * Limpia todos los datos de prueba EMAIL_QA_* dejados por scripts/qa-email-digital-downloads.ts
 *
 * Uso:
 *   npx tsx scripts/cleanup-email-qa.ts
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { cleanupEmailQaData } from "./email-qa-cleanup";

config({ path: ".env.local" });
config({ path: ".env" });

const prisma = new PrismaClient();

async function main() {
  console.log("[cleanup-email-qa] Borrando todos los registros EMAIL_QA_* …");
  await cleanupEmailQaData(prisma, { scope: "all" });
}

main()
  .catch((err) => {
    console.error("[cleanup-email-qa] Error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
