/**
 * Genera unsubscribeToken para usuarios con marketingOptIn=true y unsubscribedAt=null
 * que aún no tienen token. Necesario para que los links de baja funcionen.
 *
 * Uso: npx tsx scripts/seed-unsubscribe-tokens.ts
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      marketingOptIn: true,
      unsubscribedAt: null,
      unsubscribeToken: null,
    },
    select: { id: true },
  });

  console.log(`Usuarios sin token de baja: ${users.length}`);

  if (users.length === 0) {
    console.log("Nada por hacer.");
    return;
  }

  const BATCH = 100;
  let updated = 0;

  for (let i = 0; i < users.length; i += BATCH) {
    const batch = users.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (u) => {
        const token = randomBytes(24).toString("hex");
        await prisma.user.update({
          where: { id: u.id },
          data: { unsubscribeToken: token },
        });
        updated++;
      })
    );
  }

  console.log(`Tokens generados: ${updated}`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
