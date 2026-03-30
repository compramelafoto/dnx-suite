/**
 * Tras migrar a categorías globales: intenta mapear cada `FotorankContestCategory`
 * sin filas en `FotorankContestCategoryGlobalCategory` usando nombre + alias.
 *
 * Uso (desde repo root o packages/db):
 *   pnpm exec tsx prisma/scripts/backfill-fotorank-category-mappings.ts
 *
 * Requiere `DATABASE_URL`. No elimina datos; solo crea pivotes y actualiza flags.
 */
import { prisma } from "../../src/client.js";

function normText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normAliasKey(s: string): string {
  return normText(s).replace(/\s+/g, "").replace(/-/g, "");
}

async function main() {
  const globals = await prisma.fotorankGlobalCategory.findMany({
    where: { reviewStatus: "APPROVED", isActive: true },
    include: { aliases: true },
  });

  const byNormName = new Map<string, string>();
  const byAlias = new Map<string, string>();
  for (const g of globals) {
    byNormName.set(normText(g.name), g.id);
    byAlias.set(normAliasKey(g.name), g.id);
    for (const a of g.aliases) {
      byAlias.set(a.normalizedAlias, g.id);
    }
  }

  const categories = await prisma.fotorankContestCategory.findMany({
    include: { globalMappings: true },
  });

  let linked = 0;
  let skipped = 0;

  for (const c of categories) {
    if (c.globalMappings.length > 0) {
      skipped++;
      continue;
    }
    const nn = normText(c.name);
    const ak = normAliasKey(c.name);
    let gid = byNormName.get(nn) ?? byAlias.get(ak) ?? null;
    if (!gid) {
      const slugMatch = globals.find((g) => g.slug === c.slug);
      if (slugMatch) gid = slugMatch.id;
    }
    if (!gid) {
      await prisma.fotorankContestCategory.update({
        where: { id: c.id },
        data: { mappingIncomplete: true, isCustom: true },
      });
      continue;
    }
    await prisma.$transaction([
      prisma.fotorankContestCategoryGlobalCategory.create({
        data: { contestCategoryId: c.id, globalCategoryId: gid, isPrimary: true },
      }),
      prisma.fotorankContestCategory.update({
        where: { id: c.id },
        data: {
          mappingIncomplete: false,
          isCustom: false,
          sourceGlobalCategoryId: gid,
        },
      }),
    ]);
    linked++;
  }

  console.log(`Backfill categorías: ${linked} mapeadas, ${skipped} ya tenían mapeo, resto marcadas incompletas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
