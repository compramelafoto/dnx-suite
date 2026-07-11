import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [articles, events, settings] = await Promise.all([
    prisma.infoSpotArticle.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        contentTag: true,
        coverImageId: true,
        publishedAt: true,
        author: { select: { id: true, name: true, email: true } },
        category: { select: { name: true, slug: true } },
        coverImage: { select: { url: true, credit: true, photographerName: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.infoSpotEvent.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        contentTag: true,
        coverImageUrl: true,
        startAt: true,
        endAt: true,
        city: true,
        province: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.infoSpotSettings.findFirst({ orderBy: { createdAt: "asc" } }),
  ]);

  console.log(
    JSON.stringify(
      {
        articles,
        events,
        settings,
        summary: {
          articlesTotal: articles.length,
          articlesDemo: articles.filter((a) => a.contentTag === "DEMO").length,
          articlesReal: articles.filter((a) => a.contentTag === "REAL").length,
          articlesNeedsReview: articles.filter((a) => a.contentTag === "NEEDS_REVIEW").length,
          articlesPublishedDemo: articles.filter(
            (a) => a.contentTag === "DEMO" && a.status === "PUBLISHED",
          ).length,
          eventsTotal: events.length,
          eventsDemo: events.filter((e) => e.contentTag === "DEMO").length,
          eventsReal: events.filter((e) => e.contentTag === "REAL").length,
          eventsPublishedDemo: events.filter(
            (e) => e.contentTag === "DEMO" && e.status === "PUBLISHED",
          ).length,
        },
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
  .finally(() => prisma.$disconnect());
