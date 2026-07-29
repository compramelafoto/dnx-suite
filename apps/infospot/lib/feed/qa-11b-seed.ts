/**
 * Seed / cleanup QA controlado — ETAPA 11B.
 *
 * Marcador: `[QA INFO SPOT ETAPA 11B]` / slug `qa-11b-*`
 *
 * Seguridad:
 * - Requiere ALLOW_INFOSPOT_QA_SEED=1
 * - Rechaza si APP_URL/NEXT_PUBLIC apunta a dominio prod distinto de staging conocido
 *   (infospot-dnxsuite.vercel.app permitido como staging documentado).
 *
 * Uso:
 *   ALLOW_INFOSPOT_QA_SEED=1 pnpm --filter infospot qa:11b:seed
 *   ALLOW_INFOSPOT_QA_SEED=1 pnpm --filter infospot qa:11b:cleanup
 */

import { prisma } from "@repo/db";

const TITLE_PREFIX = "[QA INFO SPOT ETAPA 11B]";
const SLUG_PREFIX = "qa-11b-";

function title(name: string) {
  return `${TITLE_PREFIX} ${name}`;
}

function slug(suffix: string) {
  return `${SLUG_PREFIX}${suffix}`;
}

function assertSafeEnv() {
  if (process.env.ALLOW_INFOSPOT_QA_SEED !== "1") {
    throw new Error(
      "Abortado: seteá ALLOW_INFOSPOT_QA_SEED=1 para seed/cleanup QA 11B.",
    );
  }
  const appUrl =
    process.env.NEXT_PUBLIC_INFOSPOT_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_URL ||
    "";
  const blocked = [
    "infospot.com",
    "www.infospot.com",
    "infospot.ar",
  ];
  const lower = appUrl.toLowerCase();
  for (const host of blocked) {
    if (lower.includes(host)) {
      throw new Error(`Abortado: APP_URL parece producción (${appUrl}).`);
    }
  }
  // Staging documentado o local.
  const allowedHints = [
    "infospot-dnxsuite.vercel.app",
    "localhost",
    "127.0.0.1",
  ];
  if (appUrl && !allowedHints.some((h) => lower.includes(h))) {
    console.warn(
      `[qa-11b] APP_URL=${appUrl} no es un hint conocido; se permite solo con ALLOW_INFOSPOT_QA_SEED=1`,
    );
  }
}

async function resolveAuthorId(): Promise<number> {
  const u = await prisma.user.findFirst({
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (!u) throw new Error("No hay User para autor QA.");
  return u.id;
}

async function resolveCategoryId(): Promise<string> {
  const c =
    (await prisma.infoSpotCategory.findFirst({
      where: { slug: "deportes" },
      select: { id: true },
    })) ||
    (await prisma.infoSpotCategory.findFirst({ select: { id: true } }));
  if (!c) throw new Error("No hay InfoSpotCategory.");
  return c.id;
}

export async function cleanupQa11b(): Promise<{ deleted: Record<string, number> }> {
  assertSafeEnv();

  const articles = await prisma.infoSpotArticle.findMany({
    where: {
      OR: [
        { slug: { startsWith: SLUG_PREFIX } },
        { title: { startsWith: TITLE_PREFIX } },
      ],
    },
    select: { id: true },
  });
  const articleIds = articles.map((a) => a.id);

  const events = await prisma.infoSpotEvent.findMany({
    where: {
      OR: [
        { slug: { startsWith: SLUG_PREFIX } },
        { title: { startsWith: TITLE_PREFIX } },
      ],
    },
    select: { id: true },
  });
  const eventIds = events.map((e) => e.id);

  const coverages = await prisma.infoSpotCoverage.findMany({
    where: { title: { startsWith: TITLE_PREFIX } },
    select: { id: true },
  });
  const coverageIds = coverages.map((c) => c.id);

  const deleted: Record<string, number> = {};

  if (coverageIds.length) {
    deleted.coverageArticles = (
      await prisma.infoSpotCoverageArticle.deleteMany({
        where: { coverageId: { in: coverageIds } },
      })
    ).count;
  }

  if (articleIds.length) {
    deleted.placementsArticle = (
      await prisma.infoSpotHomepagePlacement.deleteMany({
        where: { articleId: { in: articleIds } },
      })
    ).count;
    deleted.articles = (
      await prisma.infoSpotArticle.deleteMany({
        where: { id: { in: articleIds } },
      })
    ).count;
  }

  if (eventIds.length) {
    deleted.calls = (
      await prisma.infoSpotPhotographerCall.deleteMany({
        where: { eventId: { in: eventIds } },
      })
    ).count;
    deleted.origins = (
      await prisma.infoSpotContentOrigin.deleteMany({
        where: { eventId: { in: eventIds } },
      })
    ).count;
    deleted.placementsEvent = (
      await prisma.infoSpotHomepagePlacement.deleteMany({
        where: { eventId: { in: eventIds } },
      })
    ).count;
    deleted.events = (
      await prisma.infoSpotEvent.deleteMany({
        where: { id: { in: eventIds } },
      })
    ).count;
  }

  if (coverageIds.length) {
    deleted.coverages = (
      await prisma.infoSpotCoverage.deleteMany({
        where: { id: { in: coverageIds } },
      })
    ).count;
  }

  return { deleted };
}

export async function seedQa11b(): Promise<{
  ids: Record<string, string>;
  counts: { articles: number; events: number };
}> {
  assertSafeEnv();
  await cleanupQa11b();

  const authorId = await resolveAuthorId();
  const categoryId = await resolveCategoryId();
  const now = new Date();
  const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const inFiveDays = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
  const lastWeekStart = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  const lastWeekEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const ids: Record<string, string> = {};

  // 1. Noticia reciente sin coordenadas
  const newsRecent = await prisma.infoSpotArticle.create({
    data: {
      title: title("Noticia reciente nacional"),
      slug: slug("news-recent"),
      excerpt: "Nota urgente sin geo para validar frescura nacional.",
      content: "Contenido QA noticia reciente sin coordenadas.",
      status: "PUBLISHED",
      contentTag: "REAL",
      editorialPriority: 10,
      publishedAt: twoHoursAgo,
      publishedByUserId: authorId,
      authorId,
      categoryId,
    },
  });
  ids.newsRecent = newsRecent.id;

  // 2. Noticia antigua sin coordenadas
  const newsOld = await prisma.infoSpotArticle.create({
    data: {
      title: title("Noticia antigua nacional"),
      slug: slug("news-old"),
      excerpt: "Nota vieja para comprobar que pierde prioridad.",
      content: "Contenido QA noticia antigua.",
      status: "PUBLISHED",
      contentTag: "REAL",
      editorialPriority: 0,
      publishedAt: fortyDaysAgo,
      publishedByUserId: authorId,
      authorId,
      categoryId,
    },
  });
  ids.newsOld = newsOld.id;

  // 3. Evento próximo Rosario + convocatoria abierta
  const eventRosario = await prisma.infoSpotEvent.create({
    data: {
      title: title("Evento Rosario con convocatoria"),
      slug: slug("event-rosario"),
      summary: "Evento cercano QA en Rosario.",
      description: "Descripción evento Rosario QA para ranking por cercanía.",
      startAt: inThreeDays,
      endAt: new Date(inThreeDays.getTime() + 4 * 60 * 60 * 1000),
      city: "Rosario",
      province: "Santa Fe",
      countryName: "Argentina",
      organizerName: "QA Org Rosario",
      organizerEmail: "qa-11b-rosario@example.com",
      categoryId,
      status: "PUBLISHED",
      contentTag: "REAL",
      originKind: "REDACCION",
      latitude: -32.9468,
      longitude: -60.6393,
      geocodingStatus: "CONFIRMED",
      locationPrecision: "CITY",
      locationVisibility: "CITY_ONLY",
      locationConfirmedAt: now,
      editorialPriority: 20,
      publishedAt: now,
      publishedByUserId: authorId,
      authorId,
      photographerCall: {
        create: {
          enabled: true,
          visibility: "PUBLIC",
          joinPolicy: "OPEN",
          desiredClfStatus: "ACTIVE",
          ownershipStatus: "RESOLVED",
          provisioningStatus: "PROVISIONED",
          organizerEmail: "qa-11b-rosario@example.com",
          maxPhotographers: 12,
          publicUrl: "https://compramelafoto.com/e/qa-11b-rosario",
          clfEventId: 911101,
          provisionedAt: now,
        },
      },
    },
  });
  ids.eventRosario = eventRosario.id;

  // 4. Evento próximo otra ciudad (Córdoba)
  const eventCordoba = await prisma.infoSpotEvent.create({
    data: {
      title: title("Evento Córdoba lejano"),
      slug: slug("event-cordoba"),
      summary: "Evento lejano respecto de Rosario.",
      description: "Descripción evento Córdoba QA.",
      startAt: inFiveDays,
      city: "Córdoba",
      province: "Córdoba",
      countryName: "Argentina",
      organizerName: "QA Org Córdoba",
      organizerEmail: "qa-11b-cba@example.com",
      categoryId,
      status: "PUBLISHED",
      contentTag: "REAL",
      originKind: "REDACCION",
      latitude: -31.4201,
      longitude: -64.1888,
      geocodingStatus: "CONFIRMED",
      locationPrecision: "CITY",
      locationVisibility: "CITY_ONLY",
      locationConfirmedAt: now,
      editorialPriority: 0,
      publishedAt: now,
      publishedByUserId: authorId,
      authorId,
    },
  });
  ids.eventCordoba = eventCordoba.id;

  // 5. Convocatoria cerrada (evento futuro, call CLOSED)
  const eventClosedCall = await prisma.infoSpotEvent.create({
    data: {
      title: title("Evento con convocatoria cerrada"),
      slug: slug("event-call-closed"),
      summary: "Debe verse como evento, no como convocatoria abierta.",
      description: "Evento QA convocatoria cerrada.",
      startAt: inFiveDays,
      city: "Rosario",
      province: "Santa Fe",
      organizerName: "QA Org Closed",
      organizerEmail: "qa-11b-closed@example.com",
      categoryId,
      status: "PUBLISHED",
      contentTag: "REAL",
      latitude: -32.95,
      longitude: -60.64,
      geocodingStatus: "CONFIRMED",
      locationVisibility: "CITY_ONLY",
      locationConfirmedAt: now,
      publishedAt: now,
      authorId,
      photographerCall: {
        create: {
          enabled: true,
          visibility: "PUBLIC",
          joinPolicy: "OPEN",
          desiredClfStatus: "CLOSED",
          ownershipStatus: "RESOLVED",
          provisioningStatus: "CLOSED",
          closedAt: now,
          organizerEmail: "qa-11b-closed@example.com",
          maxPhotographers: 5,
          publicUrl: "https://compramelafoto.com/e/qa-11b-closed",
          clfEventId: 911102,
        },
      },
    },
  });
  ids.eventClosedCall = eventClosedCall.id;

  // 6. Evento finalizado (no debe aparecer activo)
  const eventFinished = await prisma.infoSpotEvent.create({
    data: {
      title: title("Evento finalizado"),
      slug: slug("event-finished"),
      summary: "No debe entrar al feed activo.",
      description: "Evento QA finalizado.",
      startAt: lastWeekStart,
      endAt: lastWeekEnd,
      city: "Rosario",
      province: "Santa Fe",
      organizerName: "QA Org Finished",
      organizerEmail: "qa-11b-finished@example.com",
      categoryId,
      status: "PUBLISHED",
      contentTag: "REAL",
      latitude: -32.94,
      longitude: -60.65,
      geocodingStatus: "CONFIRMED",
      locationVisibility: "CITY_ONLY",
      locationConfirmedAt: now,
      editorialPriority: 90,
      publishedAt: fortyDaysAgo,
      authorId,
    },
  });
  ids.eventFinished = eventFinished.id;

  // 7. Cobertura publicada (artículo + link)
  const coverage = await prisma.infoSpotCoverage.create({
    data: {
      clfAlbumId: 911201,
      title: title("Cobertura fotográfica"),
      publicSlug: "qa-11b-album",
      publicUrl: "https://compramelafoto.com/a/qa-11b-album",
      city: "Rosario",
      discoveryStatus: "LINKED",
      editorialStatus: "PUBLISHED",
      syncStatus: "SYNCED",
      commercialStatus: "AVAILABLE",
      canShowPurchaseCta: false,
    },
  });
  ids.coverage = coverage.id;

  const coverageArticle = await prisma.infoSpotArticle.create({
    data: {
      title: title("Cobertura del fin de semana"),
      slug: slug("coverage-article"),
      excerpt: "Artículo de cobertura QA.",
      content: "Contenido QA cobertura con vínculo a álbum.",
      status: "PUBLISHED",
      contentTag: "REAL",
      editorialPriority: 30,
      clfAlbumId: 911201,
      publishedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      publishedByUserId: authorId,
      authorId,
      categoryId,
      coverageLinks: {
        create: {
          coverageId: coverage.id,
          linkRole: "PRIMARY",
          linkedByUserId: authorId,
        },
      },
    },
  });
  ids.coverageArticle = coverageArticle.id;

  // 8. Destacado (alta prioridad editorial)
  const featured = await prisma.infoSpotArticle.create({
    data: {
      title: title("Contenido destacado editorial"),
      slug: slug("featured"),
      excerpt: "Destacado con prioridad alta.",
      content: "Contenido QA destacado.",
      status: "PUBLISHED",
      contentTag: "REAL",
      editorialPriority: 80,
      publishedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      publishedByUserId: authorId,
      authorId,
      categoryId,
    },
  });
  ids.featured = featured.id;

  // 9. Borrador (nunca debe aparecer)
  const draft = await prisma.infoSpotArticle.create({
    data: {
      title: title("Borrador secreto"),
      slug: slug("draft"),
      excerpt: "No debe salir en el feed.",
      content: "Borrador QA.",
      status: "DRAFT",
      contentTag: "REAL",
      editorialPriority: 100,
      authorId,
      categoryId,
    },
  });
  ids.draft = draft.id;

  // 10+. Relleno para paginación (segunda página)
  for (let i = 1; i <= 10; i += 1) {
    const a = await prisma.infoSpotArticle.create({
      data: {
        title: title(`Relleno paginación ${i}`),
        slug: slug(`pad-${i}`),
        excerpt: `Item de relleno ${i}.`,
        content: `Contenido QA pad ${i}.`,
        status: "PUBLISHED",
        contentTag: "REAL",
        editorialPriority: 0,
        publishedAt: new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000),
        publishedByUserId: authorId,
        authorId,
        categoryId,
      },
    });
    ids[`pad${i}`] = a.id;
  }

  return {
    ids,
    counts: {
      articles: 2 + 1 + 1 + 1 + 10, // recent, old, coverage, featured, pads (+ draft not published)
      events: 4,
    },
  };
}

async function main() {
  const cmd = process.argv[2] || "seed";
  if (cmd === "cleanup") {
    const result = await cleanupQa11b();
    console.log(JSON.stringify({ ok: true, action: "cleanup", ...result }, null, 2));
  } else if (cmd === "seed") {
    const result = await seedQa11b();
    console.log(
      JSON.stringify(
        {
          ok: true,
          action: "seed",
          marker: TITLE_PREFIX,
          ids: Object.fromEntries(
            Object.entries(result.ids).map(([k, v]) => [k, v.slice(0, 8) + "…"]),
          ),
          counts: result.counts,
        },
        null,
        2,
      ),
    );
  } else {
    throw new Error(`Comando desconocido: ${cmd}`);
  }
  await prisma.$disconnect();
}

const isDirect =
  typeof process.argv[1] === "string" &&
  process.argv[1].includes("qa-11b-seed");

if (isDirect) {
  main().catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await prisma.$disconnect();
    process.exit(1);
  });
}
