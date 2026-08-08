import { prisma } from "@repo/db";

async function main() {
  const themes = await prisma.photoPromptTheme.count();
  const sub = await prisma.photoPromptSubtheme.count();
  const items = await prisma.photoPromptLibraryItem.count();
  const drafts = await prisma.photoPromptLibraryItem.count({ where: { status: "DRAFT" } });
  const approved = await prisma.photoPromptLibraryItem.count({
    where: { status: "APPROVED" },
  });
  const cine = await prisma.photoPromptLibraryItem.count({
    where: { theme: { slug: "cine" } },
  });
  const titles = await prisma.photoPromptLibraryItem.findMany({
    where: { sourceKey: { startsWith: "INITIAL_DNX_PROMPT_LIBRARY_2026_" } },
    select: { title: true, sourceKey: true },
    orderBy: { sourceKey: "asc" },
    take: 5,
  });
  console.log(JSON.stringify({ themes, sub, items, drafts, approved, cine, sample: titles }, null, 2));
  if (themes !== 11 || items !== 55 || drafts !== 55 || approved !== 0) {
    process.exitCode = 1;
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
