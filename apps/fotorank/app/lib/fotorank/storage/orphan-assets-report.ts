/**
 * Lista assets/objetos potencialmente huérfanos (staging/local).
 * No borra en producción. En staging puede borrar solo fixtures smoke.
 *
 * DATABASE_URL=... pnpm --filter fotorank exec tsx app/lib/fotorank/storage/orphan-assets-report.ts
 */
import { prisma } from "@repo/db";
import { assertSafeFotoRankDatabaseUrl } from "../../../../scripts/assert-safe-database-url";
import { getPrivateContestStorageProvider } from "./provider";

async function main() {
  assertSafeFotoRankDatabaseUrl();
  const storage = getPrivateContestStorageProvider();

  const assets = await prisma.fotorankContestEntryAsset.findMany({
    where: {
      OR: [{ entryId: null }, { isActive: false, replacedAt: { lt: new Date(Date.now() - 7 * 86400_000) } }],
    },
    select: {
      id: true,
      kind: true,
      storageKey: true,
      entryId: true,
      isActive: true,
      createdAt: true,
    },
    take: 200,
  });

  const missingObject: string[] = [];
  for (const a of assets.slice(0, 50)) {
    if (!storage.objectExists) break;
    const exists = await storage.objectExists(a.storageKey);
    if (!exists) missingObject.push(a.id);
  }

  const draftEntries = await prisma.fotorankContestEntry.count({
    where: { status: "DRAFT", updatedAt: { lt: new Date(Date.now() - 2 * 86400_000) } },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        provider: storage.providerName,
        candidates: assets.length,
        sampleMissingObject: missingObject.length,
        staleDraftEntries: draftEntries,
        note: "No se borra automáticamente. Cron futuro: listar → quarantine → delete con TTL.",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
