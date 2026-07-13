import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { EditorialAssistant } from "@/components/redaccion/editorial-assistant/editorial-assistant";
import { NewsroomBreadcrumbs } from "@/components/redaccion/newsroom-breadcrumbs";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import { getCategories } from "@/lib/articles";
import {
  buildEventCardsFromCoverages,
  eventStatusLabel,
  toCoverageCards,
  type AssistantEventCard,
  type AssistantIntent,
} from "@/lib/editorial-assistant";
import {
  hydrateAssistantEventsWithClfDates,
  listClfEventsForAssistant,
} from "@/lib/clf-queries";
import { listCoveragesForCenter } from "@/lib/coverage";
import {
  canCreateInfoSpotArticle,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";

export const metadata: Metadata = {
  title: "Asistente Editorial",
};

type PageProps = {
  searchParams: Promise<{
    intent?: string;
    eventId?: string;
    coverageId?: string;
    coverageIds?: string;
    articleId?: string;
    mode?: string;
  }>;
};

function parseIntent(raw?: string): AssistantIntent | null {
  if (!raw) return null;
  if (
    raw === "event" ||
    raw === "coverage" ||
    raw === "independent" ||
    raw === "gallery" ||
    raw === "pending"
  ) {
    return raw;
  }
  return null;
}

export default async function AsistenteEditorialPage({ searchParams }: PageProps) {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canCreateInfoSpotArticle(access.subject)) {
    notFound();
  }

  const params = await searchParams;
  const [coveragesRaw, categories] = await Promise.all([
    listCoveragesForCenter({ take: 120 }),
    getCategories(),
  ]);

  const coverageCards = toCoverageCards(coveragesRaw);
  let eventCards = buildEventCardsFromCoverages(coveragesRaw);

  const clfDates = await hydrateAssistantEventsWithClfDates(eventCards.map((e) => e.id));
  eventCards = eventCards.map((e) => {
    const hydrated = clfDates.get(e.id);
    if (!hydrated) return e;
    const startsAt = hydrated.startsAt?.toISOString() ?? null;
    const endsAt = hydrated.endsAt?.toISOString() ?? null;
    return {
      ...e,
      title: hydrated.title || e.title,
      city: hydrated.city ?? e.city,
      startsAt,
      endsAt,
      statusLabel: eventStatusLabel({ startsAt, endsAt }),
      coverageCount: Math.max(e.coverageCount, hydrated.albumCount || 0),
    };
  });

  // Completar con eventos CLF recientes/próximos que aún no tienen cobertura local
  try {
    const clfEvents = await listClfEventsForAssistant({ take: 30, window: "all" });
    const known = new Set(eventCards.map((e) => e.id));
    const extras: AssistantEventCard[] = [];
    for (const e of clfEvents) {
      if (known.has(e.id)) continue;
      const startsAt = e.startsAt?.toISOString() ?? null;
      const endsAt = e.endsAt?.toISOString() ?? null;
      extras.push({
        id: e.id,
        title: e.title,
        startsAt,
        endsAt,
        city: e.city,
        statusLabel: eventStatusLabel({ startsAt, endsAt }),
        coverageCount: e.albumCount,
        photographerCount: 0,
        photoCount: 0,
        coverThumbnailUrl: null,
        categoryHint: null,
      });
    }
    eventCards = [...eventCards, ...extras];
  } catch {
    // CLF opcional
  }

  const coverageIds = [
    ...(params.coverageId ? [params.coverageId] : []),
    ...(params.coverageIds
      ? params.coverageIds.split(",").map((s) => s.trim()).filter(Boolean)
      : []),
  ];

  // Modo agregar material: resolver coberturas del artículo
  if (params.mode === "photos" && params.articleId && coverageIds.length === 0) {
    const article = await prisma.infoSpotArticle.findUnique({
      where: { id: params.articleId },
      select: {
        clfAlbumId: true,
        coverageLinks: { select: { coverageId: true } },
      },
    });
    if (article?.coverageLinks.length) {
      coverageIds.push(...article.coverageLinks.map((l) => l.coverageId));
    } else if (article?.clfAlbumId) {
      const byAlbum = coveragesRaw.find((c) => c.clfAlbumId === article.clfAlbumId);
      if (byAlbum) coverageIds.push(byAlbum.id);
    }
  }

  const deepLink = {
    intent: parseIntent(params.intent),
    eventId: params.eventId ? Number(params.eventId) : null,
    coverageIds,
    articleId: params.articleId ?? null,
    mode: params.mode === "photos" ? ("photos" as const) : ("full" as const),
  };

  return (
    <RedaccionShell>
      <NewsroomBreadcrumbs
        items={[
          { label: "Centro Editorial", href: "/redaccion" },
          { label: "Asistente Editorial" },
        ]}
      />
      <EditorialAssistant
        bootstrap={{
          coverages: coverageCards,
          events: eventCards,
          authorDefault: access.user.name?.trim() || access.user.email,
          categories: categories.map((c) => ({ id: c.id, name: c.name })),
        }}
        deepLink={deepLink}
      />
    </RedaccionShell>
  );
}
