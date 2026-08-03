/**
 * Cleanup fixtures E2E placas (solo prefijo E2E_CLICKATON_CARDS_).
 *
 *   CLICKATON_E2E_PARTICIPANT_CARDS_CLEANUP=1 \
 *   DATABASE_URL=<ep-round-fog> \
 *   pnpm --filter clickaton e2e:clickaton-participant-cards:cleanup
 */
import { pathToFileURL } from "node:url";
import { prisma } from "@repo/db";
import { classifySmokeDatabaseUrl } from "./lib/classify-smoke-database-url";

const PREFIX = "E2E_CLICKATON_CARDS_";
const EMAIL_SUFFIX = "@e2e-cards.clickaton.staging.test";

async function assertStaging(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "";
  const cls = classifySmokeDatabaseUrl(url);
  if (cls.classification !== "staging" || !cls.safeForTestSmoke) {
    throw new Error(`Refusing: DATABASE_URL not staging-safe (${cls.reason})`);
  }
  if (!url.includes("ep-round-fog") || url.includes("ep-dawn-dew")) {
    throw new Error("Refusing: host fingerprint is not ep-round-fog staging");
  }
}

async function main() {
  if (process.env.CLICKATON_E2E_PARTICIPANT_CARDS_CLEANUP !== "1") {
    console.error("Set CLICKATON_E2E_PARTICIPANT_CARDS_CLEANUP=1 to run.");
    process.exit(1);
  }
  await assertStaging();

  const users = await prisma.user.findMany({
    where: { email: { endsWith: EMAIL_SUFFIX } },
    select: { id: true, email: true },
  });
  const userIds = users.map((u) => u.id);

  const registrations = await prisma.clickatonRegistration.findMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        { email: { endsWith: EMAIL_SUFFIX } },
        { documentNumber: { startsWith: PREFIX } },
      ],
    },
    select: { id: true },
  });
  const registrationIds = registrations.map((r) => r.id);

  const cards = await prisma.clickatonParticipantCard.findMany({
    where: { registrationId: { in: registrationIds } },
    select: { id: true, storageKey: true, assetId: true },
  });

  const cardAssetIds = cards
    .map((c) => c.assetId)
    .filter((id): id is string => Boolean(id));

  const photoAssets = await prisma.dnxMediaAsset.findMany({
    where: {
      OR: [
        { storageKey: { startsWith: PREFIX } },
        { registrationId: { in: registrationIds }, kind: "PROFILE_ORIGINAL" },
        { id: { in: cardAssetIds } },
        {
          ownerType: "PARTICIPANT_CARD",
          ownerId: { in: cards.map((c) => c.id) },
        },
      ],
    },
    select: { id: true },
  });

  const deletedCards = cards.length
    ? (
        await prisma.clickatonParticipantCard.deleteMany({
          where: { id: { in: cards.map((c) => c.id) } },
        })
      ).count
    : 0;

  const deletedAssets = photoAssets.length
    ? (
        await prisma.dnxMediaAsset.deleteMany({
          where: { id: { in: photoAssets.map((a) => a.id) } },
        })
      ).count
    : 0;

  // Clear photo refs before deleting registrations
  if (registrationIds.length) {
    await prisma.clickatonRegistration.updateMany({
      where: { id: { in: registrationIds } },
      data: { profilePhotoAssetId: null },
    });
  }

  const deletedRegs = registrationIds.length
    ? (
        await prisma.clickatonRegistration.deleteMany({
          where: { id: { in: registrationIds } },
        })
      ).count
    : 0;

  const deletedUsers = userIds.length
    ? (await prisma.user.deleteMany({ where: { id: { in: userIds } } })).count
    : 0;

  console.log(
    JSON.stringify(
      {
        ok: true,
        prefix: PREFIX,
        deleted: {
          cards: deletedCards,
          assets: deletedAssets,
          registrations: deletedRegs,
          users: deletedUsers,
        },
        note: "R2 objects (if any) under fixture keys must be deleted with storage credentials separately.",
      },
      null,
      2
    )
  );
}

const isMain =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main()
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
