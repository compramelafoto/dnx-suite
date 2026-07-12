/**
 * Seed / cleanup de datos SMOKE Etapa 11 (staging).
 *
 * Marcador: slug/title contienen `smoke-e11` / `[SMOKE-E11]`.
 *
 * Uso:
 *   pnpm --filter infospot smoke:seed
 *   pnpm --filter infospot smoke:cleanup
 */

import { prisma } from "@repo/db";

const MARK = "smoke-e11";
const TITLE_PREFIX = "[SMOKE-E11]";

function slug(suffix: string) {
  return `${MARK}-${suffix}`;
}

function title(name: string) {
  return `${TITLE_PREFIX} ${name}`;
}

async function resolveAuthorId(): Promise<number> {
  const u =
    (await prisma.user.findFirst({
      where: { email: "cuart.daniel@gmail.com" },
      select: { id: true },
    })) ||
    (await prisma.user.findFirst({ select: { id: true }, orderBy: { id: "asc" } }));
  if (!u) throw new Error("No hay User en staging para autor smoke.");
  return u.id;
}

async function resolveCategoryId(): Promise<string> {
  const c =
    (await prisma.infoSpotCategory.findFirst({
      where: { slug: "deportes" },
      select: { id: true },
    })) ||
    (await prisma.infoSpotCategory.findFirst({ select: { id: true } }));
  if (!c) throw new Error("No hay InfoSpotCategory en staging.");
  return c.id;
}

export async function cleanupSmokeE11(): Promise<{ deleted: Record<string, number> }> {
  const articles = await prisma.infoSpotArticle.findMany({
    where: { OR: [{ slug: { startsWith: MARK } }, { title: { startsWith: TITLE_PREFIX } }] },
    select: { id: true },
  });
  const articleIds = articles.map((a) => a.id);

  const events = await prisma.infoSpotEvent.findMany({
    where: { OR: [{ slug: { startsWith: MARK } }, { title: { startsWith: TITLE_PREFIX } }] },
    select: { id: true },
  });
  const eventIds = events.map((e) => e.id);

  const coverages = await prisma.infoSpotCoverage.findMany({
    where: { title: { startsWith: TITLE_PREFIX } },
    select: { id: true },
  });
  const coverageIds = coverages.map((c) => c.id);

  const photos = await prisma.infoSpotEditorialPhoto.findMany({
    where: {
      OR: [
        { coverageId: { in: coverageIds.length ? coverageIds : ["__none__"] } },
        { eventId: { in: eventIds.length ? eventIds : ["__none__"] } },
        { sourcePhotoExternalId: { startsWith: `smoke-e11-` } },
      ],
    },
    select: { id: true },
  });
  const photoIds = photos.map((p) => p.id);

  const deleted: Record<string, number> = {};

  if (photoIds.length) {
    deleted.usages = (
      await prisma.infoSpotEditorialPhotoUsage.deleteMany({
        where: { photoId: { in: photoIds } },
      })
    ).count;
    deleted.variants = (
      await prisma.infoSpotEditorialPhotoVariant.deleteMany({
        where: { photoId: { in: photoIds } },
      })
    ).count;
    deleted.photos = (
      await prisma.infoSpotEditorialPhoto.deleteMany({
        where: { id: { in: photoIds } },
      })
    ).count;
  }

  if (coverageIds.length) {
    deleted.coverageArticles = (
      await prisma.infoSpotCoverageArticle.deleteMany({
        where: { coverageId: { in: coverageIds } },
      })
    ).count;
    deleted.coveragePhotographers = (
      await prisma.infoSpotCoveragePhotographer.deleteMany({
        where: { coverageId: { in: coverageIds } },
      })
    ).count;
    deleted.coverages = (
      await prisma.infoSpotCoverage.deleteMany({
        where: { id: { in: coverageIds } },
      })
    ).count;
  }

  if (articleIds.length) {
    deleted.articleOrigins = (
      await prisma.infoSpotContentOrigin.deleteMany({
        where: { articleId: { in: articleIds } },
      })
    ).count;
    deleted.articlePlacements = (
      await prisma.infoSpotHomepagePlacement.deleteMany({
        where: { articleId: { in: articleIds } },
      })
    ).count;
    deleted.articleUsages = (
      await prisma.infoSpotEditorialPhotoUsage.deleteMany({
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
    deleted.eventOrigins = (
      await prisma.infoSpotContentOrigin.deleteMany({
        where: { eventId: { in: eventIds } },
      })
    ).count;
    deleted.calls = (
      await prisma.infoSpotPhotographerCall.deleteMany({
        where: { eventId: { in: eventIds } },
      })
    ).count;
    deleted.eventPlacements = (
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

  return { deleted };
}

export async function seedSmokeE11(): Promise<{
  events: Record<string, string>;
  articles: Record<string, string>;
}> {
  await cleanupSmokeE11();

  const authorId = await resolveAuthorId();
  const categoryId = await resolveCategoryId();
  const now = new Date();
  const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const eventA = await prisma.infoSpotEvent.create({
    data: {
      title: title("Evento A CLF próximo"),
      slug: slug("event-a"),
      summary: "Smoke A: origen CLF, próximo, geo, convocatoria.",
      description: "Descripción smoke evento A originado en ComprameLaFoto.",
      startAt: inTwoDays,
      endAt: new Date(inTwoDays.getTime() + 3 * 60 * 60 * 1000),
      city: "Rosario",
      province: "Santa Fe",
      venueName: "Parque Independencia",
      address: "Av. Pellegrini 2500",
      organizerName: "Smoke Org A",
      organizerEmail: "smoke-a@example.com",
      categoryId,
      status: "PUBLISHED",
      contentTag: "REAL",
      originKind: "SYNCED_EXTERNAL",
      latitude: -32.9595,
      longitude: -60.6615,
      geohash: "69y6",
      geocodingStatus: "CONFIRMED",
      locationPrecision: "ADDRESS",
      locationVisibility: "EXACT",
      locationConfirmedAt: now,
      locationConfirmedByUserId: authorId,
      publishedAt: now,
      publishedByUserId: authorId,
      authorId,
      photographerCall: {
        create: {
          enabled: true,
          desiredClfStatus: "ACTIVE",
          ownershipStatus: "RESOLVED",
          provisioningStatus: "PROVISIONED",
          organizerEmail: "smoke-a@example.com",
          maxPhotographers: 10,
          publicUrl: "https://compramelafoto.com/e/smoke-e11-a",
          clfEventId: 900001,
          provisionedAt: now,
        },
      },
      contentOrigins: {
        create: {
          contentType: "EVENT",
          sourceType: "COMPRAMELAFOTO",
          externalEntityType: "EVENT",
          externalId: "900001",
          externalUrl: "https://compramelafoto.com/e/smoke-e11-a",
          direction: "INBOUND",
          syncStatus: "SYNCED",
          operationalPayload: { smoke: true, mark: MARK },
        },
      },
    },
  });

  const eventB = await prisma.infoSpotEvent.create({
    data: {
      title: title("Evento B Info Spot outbound"),
      slug: slug("event-b"),
      summary: "Smoke B: creado en redacción, provisionado CLF.",
      description: "Descripción smoke evento B Info Spot → CLF.",
      startAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      city: "Córdoba",
      province: "Córdoba",
      venueName: "Plaza San Martín",
      organizerName: "Smoke Org B",
      organizerEmail: "smoke-b@example.com",
      categoryId,
      status: "PUBLISHED",
      contentTag: "REAL",
      originKind: "REDACCION",
      latitude: -31.4201,
      longitude: -64.1888,
      geohash: "6eky",
      geocodingStatus: "CONFIRMED",
      locationPrecision: "VENUE",
      locationVisibility: "APPROXIMATE",
      locationConfirmedAt: now,
      locationConfirmedByUserId: authorId,
      publishedAt: now,
      publishedByUserId: authorId,
      authorId,
      photographerCall: {
        create: {
          enabled: true,
          desiredClfStatus: "ACTIVE",
          ownershipStatus: "RESOLVED",
          provisioningStatus: "PROVISIONED",
          organizerEmail: "smoke-b@example.com",
          maxPhotographers: 5,
          publicUrl: "https://compramelafoto.com/e/smoke-e11-b",
          clfEventId: 900002,
          provisionedAt: now,
        },
      },
    },
  });

  const eventC = await prisma.infoSpotEvent.create({
    data: {
      title: title("Evento C finalizado cobertura"),
      slug: slug("event-c"),
      summary: "Smoke C: finalizado con artículo y galería.",
      description: "Descripción smoke evento C finalizado.",
      startAt: lastWeek,
      endAt: yesterday,
      city: "Rosario",
      province: "Santa Fe",
      organizerName: "Smoke Org C",
      organizerEmail: "smoke-c@example.com",
      categoryId,
      status: "PUBLISHED",
      contentTag: "REAL",
      originKind: "SYNCED_EXTERNAL",
      latitude: -32.95,
      longitude: -60.64,
      geohash: "69y6",
      geocodingStatus: "CONFIRMED",
      locationPrecision: "CITY",
      locationVisibility: "CITY_ONLY",
      locationConfirmedAt: now,
      publishedAt: now,
      authorId,
      contentOrigins: {
        create: {
          contentType: "EVENT",
          sourceType: "COMPRAMELAFOTO",
          externalEntityType: "EVENT",
          externalId: "900003",
          direction: "INBOUND",
          syncStatus: "SYNCED",
          operationalPayload: { smoke: true, mark: MARK },
        },
      },
    },
  });

  const coverageC = await prisma.infoSpotCoverage.create({
    data: {
      clfAlbumId: 910001,
      clfEventId: 900003,
      title: title("Cobertura C"),
      publicSlug: "smoke-e11-album-c",
      publicUrl: "https://compramelafoto.com/a/smoke-e11-album-c",
      city: "Rosario",
      eventTitle: eventC.title,
      photoCount: 24,
      discoveryStatus: "LINKED",
      editorialStatus: "PUBLISHED",
      syncStatus: "SYNCED",
      commercialStatus: "AVAILABLE",
      canShowPurchaseCta: true,
      photographers: {
        create: [
          { clfUserId: 801, displayName: "Smoke Foto Uno", role: "PRIMARY", photoCount: 12 },
          { clfUserId: 802, displayName: "Smoke Foto Dos", role: "CONTRIBUTOR", photoCount: 12 },
        ],
      },
    },
  });

  const articleC = await prisma.infoSpotArticle.create({
    data: {
      title: title("Crónica Evento C"),
      slug: slug("article-c"),
      excerpt: "Cobertura editorial smoke con portada, inline y galería.",
      content: [
        "## Crónica smoke",
        "",
        `<figure data-editorial-image="true" data-photo-id="PLACEHOLDER_INLINE" data-display="wide" class="is-editorial-figure"><img src="https://cdn.example/smoke-inline.webp" alt="Largada smoke" loading="lazy" /><figcaption class="is-figcaption"><span data-caption="true">Largada</span><span data-credit-text="true">Foto: Smoke Foto Uno / ComprameLaFoto</span></figcaption></figure>`,
        "",
        "Cuerpo de la nota de prueba Etapa 11.",
      ].join("\n"),
      status: "PUBLISHED",
      contentTag: "REAL",
      categoryId,
      authorId,
      publishedAt: now,
      publishedByUserId: authorId,
      coverOverridden: true,
      eventId: 900003,
    },
  });

  await prisma.infoSpotCoverageArticle.create({
    data: {
      coverageId: coverageC.id,
      articleId: articleC.id,
      linkRole: "PRIMARY",
      linkedByUserId: authorId,
    },
  });

  async function createPhoto(opts: {
    externalId: string;
    name: string;
    usage: "COVER" | "INLINE" | "GALLERY";
    sortOrder: number;
    license?: "AUTHORIZED" | "REVOKED";
    commercial?: string;
    albumUrl?: string | null;
  }) {
    const photo = await prisma.infoSpotEditorialPhoto.create({
      data: {
        coverageId: coverageC.id,
        eventId: eventC.id,
        sourcePhotoExternalId: opts.externalId,
        sourceAlbumExternalId: "910001",
        photographerExternalId: opts.name.includes("Dos") ? "802" : "801",
        photographerUserId: opts.name.includes("Dos") ? 802 : 801,
        photographerName: opts.name,
        albumUrl: opts.albumUrl === undefined ? coverageC.publicUrl : opts.albumUrl,
        purchaseUrl:
          opts.commercial === "AVAILABLE"
            ? `${coverageC.publicUrl}?photo=${opts.externalId}`
            : null,
        commercialStatus: opts.commercial ?? "AVAILABLE",
        editorialLicenseStatus: opts.license ?? "AUTHORIZED",
        editorialUsageStatus: "ACTIVE",
        processStatus: "READY",
        credit: `Foto: ${opts.name} / ComprameLaFoto`,
        copyrightText: `© ${opts.name}`,
        editorialMasterKey: `infospot/editorial/clf/${opts.externalId}/w1280.webp`,
        variants: {
          create: [640, 960, 1280, 1920].map((w) => ({
            width: w,
            format: "webp",
            url: `https://cdn.example/smoke/${opts.externalId}/w${w}.webp`,
            r2Key: `infospot/editorial/clf/${opts.externalId}/w${w}.webp`,
            bytes: 10_000,
          })),
        },
      },
    });

    await prisma.infoSpotEditorialPhotoUsage.create({
      data: {
        articleId: articleC.id,
        photoId: photo.id,
        usageType: opts.usage,
        sortOrder: opts.sortOrder,
        caption: `Caption ${opts.usage} ${opts.sortOrder}`,
        altText: `Alt ${opts.usage} ${opts.name}`,
        displaySize: opts.usage === "COVER" ? "full" : "wide",
        isCover: opts.usage === "COVER",
        createdByUserId: authorId,
      },
    });

    return photo;
  }

  await createPhoto({
    externalId: "smoke-e11-p-cover",
    name: "Smoke Foto Uno",
    usage: "COVER",
    sortOrder: 0,
    commercial: "AVAILABLE",
  });
  const inline = await createPhoto({
    externalId: "smoke-e11-p-inline",
    name: "Smoke Foto Uno",
    usage: "INLINE",
    sortOrder: 0,
    commercial: "AVAILABLE",
  });
  await createPhoto({
    externalId: "smoke-e11-p-g1",
    name: "Smoke Foto Uno",
    usage: "GALLERY",
    sortOrder: 0,
    commercial: "AVAILABLE",
  });
  await createPhoto({
    externalId: "smoke-e11-p-g2",
    name: "Smoke Foto Dos",
    usage: "GALLERY",
    sortOrder: 1,
    commercial: "AVAILABLE",
  });

  await prisma.infoSpotArticle.update({
    where: { id: articleC.id },
    data: {
      content: articleC.content.replace("PLACEHOLDER_INLINE", inline.id),
    },
  });

  const eventD = await prisma.infoSpotEvent.create({
    data: {
      title: title("Evento D comercial degradado"),
      slug: slug("event-d"),
      summary: "Smoke D: DELETED comercial, artículo intacto.",
      description: "Descripción smoke D.",
      startAt: lastWeek,
      endAt: yesterday,
      city: "Santa Fe",
      province: "Santa Fe",
      organizerName: "Smoke Org D",
      organizerEmail: "smoke-d@example.com",
      categoryId,
      status: "PUBLISHED",
      contentTag: "REAL",
      originKind: "SYNCED_EXTERNAL",
      geocodingStatus: "CONFIRMED",
      locationPrecision: "CITY",
      locationVisibility: "CITY_ONLY",
      locationConfirmedAt: now,
      publishedAt: now,
      authorId,
    },
  });

  const coverageD = await prisma.infoSpotCoverage.create({
    data: {
      clfAlbumId: 910002,
      title: title("Cobertura D degradada"),
      publicSlug: "smoke-e11-album-d",
      publicUrl: null,
      city: "Santa Fe",
      photoCount: 5,
      discoveryStatus: "LINKED",
      editorialStatus: "DRAFTING",
      syncStatus: "SYNCED",
      commercialStatus: "DELETED",
      canShowPurchaseCta: false,
    },
  });

  const articleD = await prisma.infoSpotArticle.create({
    data: {
      title: title("Nota D sin CTA"),
      slug: slug("article-d"),
      excerpt: "Imágenes autorizadas, sin compra.",
      content: "Nota smoke D: permanece sin CTA comercial.",
      status: "PUBLISHED",
      contentTag: "REAL",
      categoryId,
      authorId,
      publishedAt: now,
    },
  });

  await prisma.infoSpotCoverageArticle.create({
    data: { coverageId: coverageD.id, articleId: articleD.id, linkRole: "PRIMARY" },
  });

  await prisma.infoSpotEditorialPhoto.create({
    data: {
      coverageId: coverageD.id,
      sourcePhotoExternalId: "smoke-e11-p-d1",
      sourceAlbumExternalId: "910002",
      photographerName: "Smoke Foto D",
      albumUrl: null,
      purchaseUrl: null,
      commercialStatus: "DELETED",
      editorialLicenseStatus: "AUTHORIZED",
      editorialUsageStatus: "ACTIVE",
      processStatus: "READY",
      credit: "Foto: Smoke Foto D / ComprameLaFoto",
      variants: {
        create: [
          {
            width: 1280,
            format: "webp",
            url: "https://cdn.example/smoke/d1/w1280.webp",
            r2Key: "infospot/editorial/clf/smoke-e11-p-d1/w1280.webp",
            bytes: 8000,
          },
        ],
      },
      usages: {
        create: {
          articleId: articleD.id,
          usageType: "COVER",
          sortOrder: 0,
          altText: "Portada D smoke",
          isCover: true,
        },
      },
    },
  });

  const eventE = await prisma.infoSpotEvent.create({
    data: {
      title: title("Evento E licencia revocada"),
      slug: slug("event-e"),
      summary: "Smoke E: foto REVOKED → placeholder.",
      description: "Descripción smoke E.",
      startAt: lastWeek,
      endAt: yesterday,
      city: "Buenos Aires",
      province: "Buenos Aires",
      organizerName: "Smoke Org E",
      organizerEmail: "smoke-e@example.com",
      categoryId,
      status: "PUBLISHED",
      contentTag: "REAL",
      originKind: "REDACCION",
      publishedAt: now,
      authorId,
    },
  });

  const articleE = await prisma.infoSpotArticle.create({
    data: {
      title: title("Nota E REVOKED"),
      slug: slug("article-e"),
      excerpt: "Placeholder por licencia revocada.",
      content: "Nota smoke E con foto revocada.",
      status: "PUBLISHED",
      contentTag: "REAL",
      categoryId,
      authorId,
      publishedAt: now,
    },
  });

  await prisma.infoSpotEditorialPhoto.create({
    data: {
      eventId: eventE.id,
      sourcePhotoExternalId: "smoke-e11-p-e1",
      sourceAlbumExternalId: "910003",
      photographerName: "Smoke Foto E",
      commercialStatus: "AVAILABLE",
      editorialLicenseStatus: "REVOKED",
      editorialUsageStatus: "BLOCKED",
      processStatus: "UNAVAILABLE",
      credit: "Foto: Smoke Foto E / ComprameLaFoto",
      usages: {
        create: {
          articleId: articleE.id,
          usageType: "COVER",
          sortOrder: 0,
          altText: "No disponible",
          caption: "Caption contextual E",
          isCover: true,
        },
      },
    },
  });

  return {
    events: {
      A: eventA.slug,
      B: eventB.slug,
      C: eventC.slug,
      D: eventD.slug,
      E: eventE.slug,
    },
    articles: {
      C: articleC.slug,
      D: articleD.slug,
      E: articleE.slug,
    },
  };
}

async function main() {
  const cmd = process.argv[2] || "seed";
  if (cmd === "cleanup") {
    const result = await cleanupSmokeE11();
    console.log(JSON.stringify({ ok: true, action: "cleanup", ...result }, null, 2));
    return;
  }
  const seeded = await seedSmokeE11();
  console.log(JSON.stringify({ ok: true, action: "seed", ...seeded }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
