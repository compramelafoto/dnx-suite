/**
 * Seed idempotente del catálogo inicial DNX (55 consignas DRAFT).
 * pnpm --filter @repo/photo-prompt-library seed:initial
 */
import { prisma } from "@repo/db";
import { normalizeTitle } from "../normalize";
import {
  INITIAL_CINE_SUBTHEMES,
  INITIAL_PROMPTS,
  INITIAL_THEMES,
} from "../catalog-data";

export type SeedInitialCatalogResult = {
  themesUpserted: number;
  subthemesUpserted: number;
  itemsCreated: number;
  itemsSkipped: number;
};

export async function seedInitialCatalog(
  db: typeof prisma = prisma,
): Promise<SeedInitialCatalogResult> {
  let themesUpserted = 0;
  let subthemesUpserted = 0;
  let itemsCreated = 0;
  let itemsSkipped = 0;

  const themeIdBySlug = new Map<string, string>();

  for (const theme of INITIAL_THEMES) {
    const row = await db.photoPromptTheme.upsert({
      where: { slug: theme.slug },
      create: {
        name: theme.name,
        slug: theme.slug,
        description: theme.description,
        sortOrder: theme.sortOrder,
        active: true,
      },
      update: {
        name: theme.name,
        description: theme.description,
        sortOrder: theme.sortOrder,
        active: true,
      },
    });
    themeIdBySlug.set(theme.slug, row.id);
    themesUpserted += 1;
  }

  const cineThemeId = themeIdBySlug.get("cine");
  if (!cineThemeId) {
    throw new Error("Tema cine no encontrado tras upsert.");
  }

  const subthemeIdBySlug = new Map<string, string>();
  for (const st of INITIAL_CINE_SUBTHEMES) {
    const row = await db.photoPromptSubtheme.upsert({
      where: {
        themeId_slug: { themeId: cineThemeId, slug: st.slug },
      },
      create: {
        themeId: cineThemeId,
        name: st.name,
        slug: st.slug,
        description: st.description,
        sortOrder: st.sortOrder,
        active: true,
      },
      update: {
        name: st.name,
        description: st.description,
        sortOrder: st.sortOrder,
        active: true,
      },
    });
    subthemeIdBySlug.set(st.slug, row.id);
    subthemesUpserted += 1;
  }

  for (const prompt of INITIAL_PROMPTS) {
    const themeId = themeIdBySlug.get(prompt.themeSlug);
    if (!themeId) {
      throw new Error(`Tema desconocido: ${prompt.themeSlug}`);
    }
    const subthemeId = prompt.subthemeSlug
      ? (subthemeIdBySlug.get(prompt.subthemeSlug) ?? null)
      : null;

    const existing = await db.photoPromptLibraryItem.findUnique({
      where: { sourceKey: prompt.sourceKey },
      select: { id: true, status: true, title: true, description: true },
    });
    if (existing) {
      // Solo resincroniza contenido editorial si sigue DRAFT (nunca aprueba).
      if (existing.status === "DRAFT") {
        await db.photoPromptLibraryItem.update({
          where: { id: existing.id },
          data: {
            title: prompt.title,
            normalizedTitle: normalizeTitle(prompt.title),
            description: prompt.description,
            themeId,
            subthemeId,
            inspirationType: prompt.inspirationType ?? null,
            inspirationLabel: prompt.inspirationLabel ?? null,
            inspirationNotes: prompt.inspirationNotes ?? null,
            tags: prompt.tags,
            difficulty: prompt.difficulty,
            language: prompt.language,
            universal: prompt.universal,
          },
        });
      }
      itemsSkipped += 1;
      continue;
    }

    const created = await db.photoPromptLibraryItem.create({
      data: {
        title: prompt.title,
        normalizedTitle: normalizeTitle(prompt.title),
        description: prompt.description,
        themeId,
        subthemeId,
        inspirationType: prompt.inspirationType ?? null,
        inspirationLabel: prompt.inspirationLabel ?? null,
        inspirationNotes: prompt.inspirationNotes ?? null,
        tags: prompt.tags,
        difficulty: prompt.difficulty,
        language: prompt.language,
        universal: prompt.universal,
        status: "DRAFT",
        version: 1,
        sourceKey: prompt.sourceKey,
        metadataJson: { seed: "INITIAL_DNX_PROMPT_LIBRARY_2026" },
      },
    });

    await db.photoPromptLibraryVersion.create({
      data: {
        libraryItemId: created.id,
        version: 1,
        title: created.title,
        description: created.description,
        themeId: created.themeId,
        subthemeId: created.subthemeId,
        inspirationType: created.inspirationType,
        inspirationLabel: created.inspirationLabel,
        inspirationNotes: created.inspirationNotes,
        tags: created.tags,
        difficulty: created.difficulty,
        language: created.language,
        universal: created.universal,
        status: "DRAFT",
        changeSummary: "Seed inicial catálogo DNX",
        snapshotJson: {
          sourceKey: prompt.sourceKey,
          seed: "INITIAL_DNX_PROMPT_LIBRARY_2026",
        },
      },
    });

    await db.photoPromptLibraryAuditEvent.create({
      data: {
        libraryItemId: created.id,
        action: "CREATE",
        comment: "Seed inicial",
        metadataJson: { sourceKey: prompt.sourceKey },
      },
    });

    itemsCreated += 1;
  }

  return { themesUpserted, subthemesUpserted, itemsCreated, itemsSkipped };
}

async function main() {
  const result = await seedInitialCatalog();
  console.log("seed-initial-catalog OK", result);
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("seed-initial-catalog.ts") ||
    process.argv[1].includes("seed-initial-catalog"));

if (isMain) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect().catch(() => undefined);
    });
}
