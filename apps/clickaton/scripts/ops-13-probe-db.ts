import { prisma } from "@repo/db";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const host = url.split("@")[1]?.split("/")[0] ?? "?";

  const raw = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT
      (SELECT count(*)::int FROM "ClickatonEdition") AS editions,
      (SELECT count(*)::int FROM "ClickatonRegistration") AS registrations,
      (SELECT count(*)::int FROM "ClickatonPrompt") AS prompts,
      (SELECT count(*)::int FROM "ClickatonPhotoSubmission") AS submissions,
      (SELECT count(*)::int FROM "FotorankContest") AS contests,
      (SELECT count(*)::int FROM "User") AS users,
      (SELECT to_regclass('public."PhotoPromptLibraryItem"') IS NOT NULL) AS has_library
  `);

  let libraryItems = -1;
  if (raw[0]?.has_library) {
    const lib = await prisma.$queryRawUnsafe<[{ c: number }]>(
      `SELECT count(*)::int AS c FROM "PhotoPromptLibraryItem"`,
    );
    libraryItems = Number(lib[0]?.c ?? 0);
  }

  console.log(JSON.stringify({ host, ...raw[0], libraryItems }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
