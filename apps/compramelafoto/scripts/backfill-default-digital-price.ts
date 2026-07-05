/**
 * Backfill: asigna el precio mínimo de foto digital de la plataforma
 * a todos los usuarios que tienen defaultDigitalPhotoPrice en null.
 * Así el valor por defecto nunca queda nulo para usuarios existentes.
 *
 * Ejecutar: npx tsx scripts/backfill-default-digital-price.ts
 */

import { PrismaClient } from "@prisma/client";
import { getAppConfig } from "../lib/services/settingsService";

const prisma = new PrismaClient();

async function main() {
  const config = await getAppConfig();
  const platformMin = config?.minDigitalPhotoPrice ?? 5000;

  const result = await prisma.user.updateMany({
    where: { defaultDigitalPhotoPrice: null },
    data: { defaultDigitalPhotoPrice: platformMin },
  });

  console.log(
    `✅ Backfill completado: ${result.count} usuario(s) actualizados con precio por defecto de foto digital = $${platformMin} (mínimo de la plataforma).`
  );
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
